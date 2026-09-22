<?php

namespace App\Http\Controllers;

use App\Models\InvestmentAccount;
use App\Models\PortfolioSnapshot;
use App\Models\PortfolioSnapshotItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\QueryException;

class PortfolioSnapshotController extends Controller
{
    public function bulkStore(Request $request)
    {
        $request->validate([
            'snapshots' => 'required|array',
            'snapshots.*.investment_account_id' => 'required|exists:investment_accounts,id',
            'snapshots.*.as_of_date' => 'required|date',
            'snapshots.*.provider' => 'required|string',
            'snapshots.*.document_type' => 'nullable|string',
            'snapshots.*.source_metadata' => 'nullable|array',
            'snapshots.*.items' => 'required|array',
            'snapshots.*.items.*.symbol' => 'required|string',
            'snapshots.*.items.*.asset_name' => 'nullable|string',
            'snapshots.*.items.*.quantity' => 'required|numeric',
            'snapshots.*.items.*.average_price' => 'nullable|numeric',
            'snapshots.*.items.*.market_price' => 'nullable|numeric',
            'snapshots.*.items.*.market_value' => 'nullable|numeric',
            'snapshots.*.items.*.currency' => 'nullable|string',
        ]);

        $user = $request->user();
        $successful = [];
        $failed = [];

        foreach ($request->snapshots as $snapshotData) {
            $investmentAccount = InvestmentAccount::find($snapshotData['investment_account_id']);
            if ($investmentAccount->user_id !== $user->id) {
                $failed[] = [
                    'snapshot' => $snapshotData,
                    'reason' => 'Unauthorized access to this investment account.'
                ];
                continue;
            }

            // Generate snapshot hash for deduplication: account_id | as_of_date | provider
            $hashData = implode('|', [
                $snapshotData['investment_account_id'],
                date('Y-m-d', strtotime($snapshotData['as_of_date'])),
                $snapshotData['provider']
            ]);
            $snapshotHash = md5($hashData);

            try {
                DB::beginTransaction();

                $snapshot = PortfolioSnapshot::create([
                    'investment_account_id' => $snapshotData['investment_account_id'],
                    'as_of_date' => $snapshotData['as_of_date'],
                    'provider' => $snapshotData['provider'],
                    'document_type' => $snapshotData['document_type'] ?? null,
                    'source_metadata' => $snapshotData['source_metadata'] ?? null,
                    'snapshot_hash' => $snapshotHash,
                ]);

                foreach ($snapshotData['items'] as $itemData) {
                    $snapshot->items()->create([
                        'symbol' => $itemData['symbol'],
                        'asset_name' => $itemData['asset_name'] ?? null,
                        'quantity' => $itemData['quantity'],
                        'average_price' => $itemData['average_price'] ?? null,
                        'market_price' => $itemData['market_price'] ?? null,
                        'market_value' => $itemData['market_value'] ?? null,
                        'currency' => $itemData['currency'] ?? 'IDR',
                    ]);
                }

                DB::commit();
                $snapshot->load('items');
                $successful[] = $snapshot;
            } catch (QueryException $e) {
                DB::rollBack();
                if (isset($e->errorInfo[1]) && in_array($e->errorInfo[1], [1062, 19])) {
                    $failed[] = [
                        'snapshot' => $snapshotData,
                        'reason' => 'Duplicate snapshot detected for this date and provider.'
                    ];
                } else {
                    $failed[] = [
                        'snapshot' => $snapshotData,
                        'reason' => 'Database error: ' . $e->getMessage()
                    ];
                }
            }
        }

        return response()->json([
            'message' => 'Bulk snapshot insert completed.',
            'successful' => $successful,
            'failed' => $failed
        ], 200);
    }
}
