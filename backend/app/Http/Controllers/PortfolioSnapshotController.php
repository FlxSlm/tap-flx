<?php

namespace App\Http\Controllers;

use App\Models\InvestmentAccount;
use App\Models\PortfolioSnapshot;
use App\Services\Integrity\SnapshotContract;
use App\Services\Integrity\SourceImporter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PortfolioSnapshotController extends Controller
{
    public function bulkStore(Request $request)
    {
        $input = $request->validate(['snapshots' => 'required|array|list|min:1|max:100', 'snapshots.*' => 'required|array'])['snapshots'];
        $rows = array_map(fn ($row) => SnapshotContract::validate($row), $input);
        $successful = [];
        $failed = [];
        foreach ($rows as $index => $data) {
            $account = InvestmentAccount::with('platform')->findOrFail($data['investment_account_id']);
            if ($account->user_id !== $request->user()->id) {
                $failed[] = ['index' => $index, 'reason' => 'Unauthorized access to this investment account.'];

                continue;
            }
            if (strtoupper($account->platform->code) !== $data['provider']) {
                throw ValidationException::withMessages(['provider' => 'Document provider must match the investment account.']);
            }
            DB::transaction(function () use ($data, $account, $index, &$successful, &$failed) {
                InvestmentAccount::whereKey($account->id)->lockForUpdate()->firstOrFail();
                if (PortfolioSnapshot::where('investment_account_id', $account->id)->whereDate('as_of_date', $data['as_of_date'])->exists()) {
                    $failed[] = ['index' => $index, 'reason' => 'Snapshot already exists; use source imports for a reviewable additional observation.'];

                    return;
                }
                $items = $data['items'];
                unset($data['items']);
                $snapshot = PortfolioSnapshot::create([...$data, 'snapshot_hash' => SourceImporter::digest([$account->id, $data['as_of_date'], $data['provider']])]);
                foreach ($items as $item) {
                    $snapshot->items()->create($item);
                }
                $successful[] = $snapshot->load('items');
            });
        }

        return response()->json(['message' => 'Bulk snapshot insert completed.', 'successful' => $successful, 'failed' => $failed]);
    }
}
