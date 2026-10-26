<?php

namespace App\Http\Controllers;

use App\Models\InvestmentAccount;
use App\Models\PortfolioSnapshot;
use App\Services\Holdings\HoldingsProjectionService;
use App\Services\Holdings\SnapshotBaselineSelector;
use App\Services\Holdings\SnapshotConfirmationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class HoldingsController extends Controller
{
    private function account(Request $request, int $account): InvestmentAccount
    {
        return InvestmentAccount::with('platform')->where('user_id', $request->user()->id)->findOrFail($account);
    }

    public function index(Request $request, int $account, HoldingsProjectionService $projection, SnapshotBaselineSelector $selector)
    {
        $ownerAccount = $this->account($request, $account);
        $data = $request->validate([
            'as_of' => 'required|date_format:Y-m-d', 'baseline_snapshot_id' => 'nullable|integer|min:1',
            'timezone' => 'nullable|required_with:cutoff|timezone', 'cutoff' => 'nullable|required_with:timezone|date_format:H:i:s',
        ]);
        $result = DB::transaction(function () use ($ownerAccount, $data, $projection, $selector) {
            InvestmentAccount::whereKey($ownerAccount->id)->sharedLock()->firstOrFail();

            return [
                'account' => ['id' => $ownerAccount->id, 'account_name' => $ownerAccount->account_name, 'provider' => strtoupper($ownerAccount->platform->code)],
                'as_of' => $data['as_of'], 'reported' => $selector->reported($ownerAccount, $data['as_of']),
                'calculated' => $projection->project($ownerAccount, $data['as_of'], isset($data['baseline_snapshot_id']) ? (int) $data['baseline_snapshot_id'] : null, $data['timezone'] ?? null, $data['cutoff'] ?? null),
            ];
        });

        return response()->json($result)->header('Cache-Control', 'private, no-store');
    }

    public function snapshots(Request $request, int $account, SnapshotBaselineSelector $selector)
    {
        $ownerAccount = $this->account($request, $account);
        $data = $request->validate(['as_of' => 'required|date_format:Y-m-d', 'page' => 'sometimes|integer|min:1']);
        $rows = PortfolioSnapshot::with('items')->where('investment_account_id', $account)->whereDate('as_of_date', '<=', $data['as_of'])->orderByDesc('as_of_date')->orderByDesc('id')->paginate(20);

        return response()->json([
            'data' => $rows->getCollection()->map(fn ($snapshot) => $selector->describe($snapshot, $ownerAccount))->all(),
            'meta' => ['current_page' => $rows->currentPage(), 'last_page' => $rows->lastPage()],
        ])->header('Cache-Control', 'private, no-store');
    }

    public function confirm(Request $request, int $account, int $snapshot, SnapshotConfirmationService $service)
    {
        $ownerAccount = $this->account($request, $account);
        if (array_diff(array_keys($request->all()), ['confirmed', 'expected_fingerprint', 'coverage', 'items'])) {
            throw ValidationException::withMessages(['payload' => 'Only snapshot confirmation metadata is accepted.']);
        }
        $data = $request->validate([
            'confirmed' => 'required|accepted', 'expected_fingerprint' => ['required', 'regex:/^[a-f0-9]{64}$/D'],
            'coverage' => ['required', Rule::in(['FULL', 'PARTIAL', 'UNKNOWN'])],
            'items' => 'present|array|list|max:1000', 'items.*' => 'required|array:id,unit',
            'items.*.id' => 'required|integer|distinct:strict',
            'items.*.unit' => ['required', Rule::in(['SHARE', 'LOT', 'COIN'])],
        ]);

        return response()->json(['data' => $service->confirm($ownerAccount, $snapshot, $request->user()->id, $data)])->header('Cache-Control', 'private, no-store');
    }
}
