<?php

namespace App\Http\Controllers;

use App\Models\InvestmentAccount;
use App\Services\Reconciliation\ReconciliationHistory;
use App\Services\Reconciliation\ReconciliationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReconciliationController extends Controller
{
    private function account(Request $request, int $account): InvestmentAccount
    {
        return InvestmentAccount::with('platform')->where('user_id', $request->user()->id)->findOrFail($account);
    }

    private function input(Request $request, bool $saving = false): array
    {
        $allowed = ['opening_snapshot_id', 'closing_snapshot_id', 'timezone', 'cutoff', 'coverage', 'previous_input_version'];
        if ($saving) {
            $allowed[] = 'expected_input_version';
        }
        if (array_diff(array_keys($request->all()), $allowed)) {
            throw ValidationException::withMessages(['payload' => 'Only reconciliation selection and confirmation fields are accepted.']);
        }
        $rules = [
            'opening_snapshot_id' => 'required|integer|min:1', 'closing_snapshot_id' => 'required|integer|min:1',
            'timezone' => 'nullable|required_with:cutoff|timezone', 'cutoff' => 'nullable|required_with:timezone|date_format:H:i:s',
            'previous_input_version' => ['sometimes', 'regex:/^[a-f0-9]{64}$/D'],
            'expected_input_version' => [$saving ? 'required' : 'prohibited', 'regex:/^[a-f0-9]{64}$/D'],
        ];
        if (array_key_exists('coverage', $request->all())) {
            $rules += [
                'coverage' => 'required|array:confirmed,input_version,source_ids',
                'coverage.confirmed' => 'required|accepted',
                'coverage.input_version' => ['required', 'regex:/^[a-f0-9]{64}$/D'],
                'coverage.source_ids' => 'required|array|list|min:1|max:3000',
                'coverage.source_ids.*' => 'required|uuid|distinct:strict',
            ];
        }

        return $request->validate($rules);
    }

    public function evaluate(Request $request, int $account, ReconciliationService $engine, ReconciliationHistory $history)
    {
        $ownerAccount = $this->account($request, $account);
        $input = $this->input($request);
        $result = DB::transaction(function () use ($ownerAccount, $request, $input, $engine) {
            InvestmentAccount::whereKey($ownerAccount->id)->sharedLock()->firstOrFail();

            return $engine->evaluate($ownerAccount, $request->user()->id, $input);
        });

        return response()->json(['data' => $result, 'history_available' => $history->available()])->header('Cache-Control', 'private, no-store');
    }

    public function store(Request $request, int $account, ReconciliationHistory $history)
    {
        $ownerAccount = $this->account($request, $account);
        $input = $this->input($request, true);
        if (! $history->available()) {
            return response()->json(['code' => 'HISTORY_SCHEMA_PENDING', 'message' => 'Comparison is available; saving history requires the reviewed additive migration.'], 503);
        }
        $result = DB::transaction(function () use ($ownerAccount, $request, $input, $history) {
            InvestmentAccount::whereKey($ownerAccount->id)->lockForUpdate()->firstOrFail();

            return $history->store($ownerAccount, $request->user()->id, $input);
        });

        return response()->json($result, $result['replayed'] ? 200 : 201)->header('Cache-Control', 'private, no-store');
    }

    public function index(Request $request, int $account, ReconciliationHistory $history)
    {
        $ownerAccount = $this->account($request, $account);
        $request->validate(['page' => 'sometimes|integer|min:1']);
        if (! $history->available()) {
            return response()->json(['available' => false, 'code' => 'HISTORY_SCHEMA_PENDING', 'data' => []])->header('Cache-Control', 'private, no-store');
        }
        $response = DB::transaction(function () use ($ownerAccount, $request, $history) {
            InvestmentAccount::whereKey($ownerAccount->id)->sharedLock()->firstOrFail();
            $runs = DB::table('reconciliation_runs')->where('investment_account_id', $ownerAccount->id)->orderByDesc('id')->paginate(10);

            return ['available' => true, 'data' => $runs->getCollection()->map(fn ($run) => $history->describe($run, $ownerAccount, $request->user()->id, false))->all(),
                'meta' => ['current_page' => $runs->currentPage(), 'last_page' => $runs->lastPage()]];
        });

        return response()->json($response)->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, int $account, string $run, ReconciliationHistory $history)
    {
        $ownerAccount = $this->account($request, $account);
        abort_unless($history->available(), 404);
        $response = DB::transaction(function () use ($ownerAccount, $request, $run, $history) {
            InvestmentAccount::whereKey($ownerAccount->id)->sharedLock()->firstOrFail();
            $record = DB::table('reconciliation_runs')->where('investment_account_id', $ownerAccount->id)->where('public_id', $run)->first();
            abort_unless($record, 404);

            return $history->describe($record, $ownerAccount, $request->user()->id, true);
        });

        return response()->json($response)->header('Cache-Control', 'private, no-store');
    }
}
