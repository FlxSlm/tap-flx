<?php

namespace App\Http\Controllers;

use App\Models\InvestmentAccount;
use App\Models\Platform;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class InvestmentAccountController extends Controller
{
    private function present(InvestmentAccount $account): array
    {
        return ['id' => $account->id, 'account_name' => $account->account_name,
            'platform_code' => $account->platform->code, 'platform_name' => $account->platform->name];
    }

    /**
     * List investment accounts belonging to the authenticated user.
     */
    public function index(Request $request)
    {
        $accounts = InvestmentAccount::where('user_id', $request->user()->id)
            ->with('platform')
            ->get()
            ->map(fn ($account) => $this->present($account));

        return response()->json(['data' => $accounts])->header('Cache-Control', 'private, no-store');
    }

    public function store(Request $request)
    {
        if (array_diff(array_keys($request->all()), ['provider', 'account_name'])) {
            throw ValidationException::withMessages(['payload' => 'Only provider and account label are accepted.']);
        }
        $data = $request->validate([
            'provider' => ['required', Rule::in(['stockbit', 'bions', 'pluang'])],
            'account_name' => ['required', 'string', 'max:80', 'regex:/^[\p{L}\p{M}\p{N} ._()\x{0027}-]+$/u', 'regex:/\p{L}/u'],
        ]);
        $label = preg_replace('/ +/u', ' ', trim($data['account_name']));
        $result = DB::transaction(function () use ($request, $data, $label) {
            // Serialize explicit account creation per owner; duplicate retries do not add rows.
            User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            $names = ['stockbit' => 'Stockbit', 'bions' => 'BIONS', 'pluang' => 'Pluang Crypto'];
            $platform = Platform::firstOrCreate(['code' => $data['provider']], ['name' => $names[$data['provider']]]);
            $existing = InvestmentAccount::with('platform')->where('user_id', $request->user()->id)->where('platform_id', $platform->id)->get()
                ->first(fn ($account) => mb_strtolower(trim((string) $account->account_name)) === mb_strtolower($label));
            if ($existing) {
                return ['data' => $this->present($existing), 'already_exists' => true];
            }
            $account = InvestmentAccount::create(['user_id' => $request->user()->id, 'platform_id' => $platform->id, 'account_name' => $label]);
            $account->setRelation('platform', $platform);

            return ['data' => $this->present($account), 'already_exists' => false];
        });

        return response()->json($result, $result['already_exists'] ? 200 : 201)->header('Cache-Control', 'private, no-store');
    }
}
