<?php

namespace App\Http\Controllers;

use App\Models\AutomaticIngestion;
use App\Models\EmailConnection;
use App\Models\InvestmentAccount;
use App\Models\User;
use App\Services\Automatic\AutomaticFailure;
use App\Services\Automatic\AutomaticSync;
use App\Services\Automatic\GmailClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AutomaticController extends Controller
{
    private function available(bool $requireEnabled = true): void
    {
        if ($requireEnabled && ! config('automatic.enabled')) {
            throw new AutomaticFailure('AUTOMATIC_NOT_CONFIGURED');
        }
        if (! Schema::hasTable('automatic_ingestions') || ! Schema::hasColumn('investment_accounts', 'acquisition_mode')) {
            throw new AutomaticFailure('AUTOMATIC_SCHEMA_PENDING');
        }
    }

    public function index(Request $request, GmailClient $gmail)
    {
        $ready = Schema::hasTable('automatic_ingestions') && Schema::hasColumn('investment_accounts', 'acquisition_mode');

        return response()->json([
            'enabled' => (bool) config('automatic.enabled'), 'configured' => (bool) $gmail->configured(), 'schema_ready' => $ready,
            'connections' => EmailConnection::where('user_id', $request->user()->id)->where('oauth_provider', 'google')->get(['id', 'email_address', 'is_active', 'last_sync_at']),
            'accounts' => $ready ? InvestmentAccount::where('user_id', $request->user()->id)->get(['id', 'account_name', 'email_connection_id', 'acquisition_mode', 'sync_status', 'automatic_last_sync_at']) : [],
        ])->header('Cache-Control', 'private, no-store');
    }

    public function connect(Request $request, GmailClient $gmail)
    {
        $this->available();
        if (! $gmail->configured()) {
            throw new AutomaticFailure('AUTOMATIC_NOT_CONFIGURED');
        }
        abort_unless($request->hasSession(), 409);
        $state = Str::random(64);
        $verifier = Str::random(96);
        $request->session()->put('gmail_oauth', Crypt::encryptString(json_encode(['state' => $state, 'verifier' => $verifier, 'user' => $request->user()->id, 'expires' => now()->addMinutes(10)->timestamp], JSON_THROW_ON_ERROR)));

        return response()->json(['authorization_url' => $gmail->authorization($state, $verifier)])->header('Cache-Control', 'private, no-store');
    }

    public function callback(Request $request, GmailClient $gmail)
    {
        $code = 'OAUTH_REJECTED';
        try {
            $this->available();
            $encrypted = $request->session()->pull('gmail_oauth');
            $context = $encrypted ? json_decode(Crypt::decryptString($encrypted), true, 512, JSON_THROW_ON_ERROR) : [];
            if (! $request->user() || ($context['user'] ?? null) !== $request->user()->id || ($context['expires'] ?? 0) < now()->timestamp
                || ! is_string($request->query('state')) || ! hash_equals($context['state'] ?? '', $request->query('state'))
                || ! is_string($request->query('code')) || strlen($request->query('code')) > 4096 || $request->has('error')) {
                throw new AutomaticFailure('OAUTH_STATE_INVALID');
            }
            $gmail->connect($request->user()->id, $request->query('code'), $context['verifier']);
            $code = 'CONNECTED';
        } catch (AutomaticFailure $error) {
            $code = $error->reason;
        } catch (\Throwable) {
            $code = 'OAUTH_REJECTED';
        }

        return redirect(config('automatic.frontend_url').'?gmail='.$code)->header('Cache-Control', 'private, no-store')->header('Referrer-Policy', 'no-referrer');
    }

    public function mode(Request $request, int $account)
    {
        $data = $request->validate(['mode' => ['required', Rule::in(['PRIVACY', 'AUTOMATIC'])], 'connection_id' => 'nullable|integer', 'consent' => 'exclude_unless:mode,AUTOMATIC|required|accepted']);
        $this->available($data['mode'] !== 'PRIVACY');
        DB::transaction(function () use ($request, $account, $data) {
            User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            $owned = InvestmentAccount::whereKey($account)->where('user_id', $request->user()->id)->lockForUpdate()->firstOrFail();
            $connection = null;
            if ($data['mode'] === 'AUTOMATIC') {
                $connection = EmailConnection::whereKey($data['connection_id'] ?? null)->where('user_id', $request->user()->id)->where('is_active', true)->where('oauth_provider', 'google')->firstOrFail();
            }
            $owned->forceFill(['acquisition_mode' => $data['mode'], 'acquisition_epoch' => $owned->acquisition_epoch + 1,
                'email_connection_id' => $connection?->id, 'ingestion_public_id' => $owned->ingestion_public_id ?? (string) Str::uuid(),
                'automatic_page_token' => null, 'sync_lease' => null, 'sync_started_at' => null, 'sync_status' => $connection ? 'IDLE' : 'PAUSED'])->save();
        });

        return response()->json(['status' => $data['mode']]);
    }

    public function disconnect(Request $request, int $connection, GmailClient $gmail)
    {
        $this->available(false);
        $credentials = DB::transaction(function () use ($request, $connection) {
            User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            $owned = EmailConnection::whereKey($connection)->where('user_id', $request->user()->id)->firstOrFail();
            // Pause accounts before locking credentials: same order as sync/import.
            InvestmentAccount::where('user_id', $request->user()->id)->where('email_connection_id', $owned->id)->update([
                'acquisition_mode' => 'PRIVACY', 'acquisition_epoch' => DB::raw('acquisition_epoch + 1'), 'sync_status' => 'PAUSED',
                'sync_lease' => null, 'sync_started_at' => null, 'automatic_page_token' => null,
            ]);
            $owned = EmailConnection::whereKey($owned->id)->lockForUpdate()->firstOrFail();
            $credentials = $owned->credentials;
            $owned->update(['credentials' => null, 'is_active' => false]);

            return $credentials;
        });

        return response()->json(['status' => 'DISCONNECTED', 'revocation_confirmed' => $gmail->revoke($credentials)]);
    }

    public function sync(Request $request, int $account, AutomaticSync $sync)
    {
        $this->available();
        $owned = InvestmentAccount::whereKey($account)->where('user_id', $request->user()->id)->firstOrFail();

        return response()->json($sync->sync($owned));
    }

    public function reviews(Request $request)
    {
        $this->available();
        $accounts = InvestmentAccount::where('user_id', $request->user()->id)->pluck('id');

        return response()->json(['data' => AutomaticIngestion::whereIn('investment_account_id', $accounts)->latest('id')->limit(50)
            ->get(['id', 'public_id', 'investment_account_id', 'status', 'created_at', 'updated_at', 'receipt'])->makeHidden(['id'])])->header('Cache-Control', 'private, no-store');
    }

    private function owned(Request $request, string $ingestion): AutomaticIngestion
    {
        $record = AutomaticIngestion::where('public_id', $ingestion)->firstOrFail();
        abort_unless(InvestmentAccount::whereKey($record->investment_account_id)->where('user_id', $request->user()->id)->exists(), 404);

        return $record;
    }

    public function preview(Request $request, string $ingestion)
    {
        $this->available();
        $record = $this->owned($request, $ingestion);
        $account = InvestmentAccount::findOrFail($record->investment_account_id);
        abort_unless($record->policy_epoch === $account->acquisition_epoch && $account->acquisition_mode === 'AUTOMATIC', 409);

        return response()->json(['status' => $record->status, 'payload' => $record->structured_payload, 'receipt' => $record->receipt,
            'sender_assurance' => 'UNVERIFIED', 'coverage' => 'UNKNOWN'])->header('Cache-Control', 'private, no-store');
    }

    public function unlock(Request $request, string $ingestion, AutomaticSync $sync)
    {
        $this->available();
        // Never use Laravel password validation messages that echo input. No request logging middleware.
        $data = $request->validate(['password' => 'required|string|max:256']);

        return response()->json(['status' => $sync->unlock($this->owned($request, $ingestion), $data['password'])])->header('Cache-Control', 'private, no-store');
    }

    public function confirm(Request $request, string $ingestion, AutomaticSync $sync)
    {
        $this->available();
        $request->validate(['confirmed' => 'required|accepted']);
        abort_if(array_diff(array_keys($request->all()), ['confirmed']), 422);

        return response()->json($sync->confirm($this->owned($request, $ingestion), $request->user()))->header('Cache-Control', 'private, no-store');
    }

    private function orchestrator(Request $request): void
    {
        $secret = config('automatic.orchestrator_secret') ?? '';
        abort_unless(strlen($secret) >= 32 && in_array($request->ip(), config('automatic.orchestrator_ips'), true) && hash_equals($secret, $request->bearerToken() ?? ''), 403);
        $this->available();
    }

    public function jobs(Request $request)
    {
        $this->orchestrator($request);

        return response()->json(InvestmentAccount::where('acquisition_mode', 'AUTOMATIC')->whereNotNull('ingestion_public_id')->limit(100)->get(['ingestion_public_id'])
            ->map(fn ($row) => ['job' => $row->ingestion_public_id]))->header('Cache-Control', 'no-store');
    }

    public function runJob(Request $request, string $job, AutomaticSync $sync)
    {
        $this->orchestrator($request);

        return response()->json($sync->sync(InvestmentAccount::where('ingestion_public_id', $job)->firstOrFail()))->header('Cache-Control', 'no-store');
    }
}
