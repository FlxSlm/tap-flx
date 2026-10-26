<?php

namespace App\Services\Holdings;

use App\Models\InvestmentAccount;
use App\Models\PortfolioSnapshot;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

final class SnapshotConfirmationService
{
    public function __construct(private SnapshotBaselineSelector $selector) {}

    public function confirm(InvestmentAccount $account, int $snapshotId, int $actor, array $input): array
    {
        return DB::transaction(function () use ($account, $snapshotId, $actor, $input) {
            InvestmentAccount::whereKey($account->id)->lockForUpdate()->firstOrFail();
            $snapshot = PortfolioSnapshot::where('investment_account_id', $account->id)->lockForUpdate()->findOrFail($snapshotId);
            $before = $this->selector->describe($snapshot, $account);
            if (! hash_equals($before['fingerprint'], $input['expected_fingerprint'])) {
                throw new ConflictHttpException('Snapshot changed; reload before confirming.');
            }
            $immutableIssues = array_diff($before['baseline_issues'], ['SNAPSHOT_NOT_CONFIRMED', 'UNKNOWN_OR_INVALID_SNAPSHOT_UNIT', 'SNAPSHOT_SOURCE_REQUIRES_REVIEW', 'INVALID_FULL_POSITION_COVERAGE']);
            if ($immutableIssues !== []) {
                throw new ConflictHttpException('Snapshot conflict or invalid source requires review before confirmation.');
            }
            $observations = DB::table('source_observations')->where('portfolio_snapshot_id', $snapshot->id)->get();
            if ($observations->contains(fn ($row) => $row->validation_status !== 'PASSED' || ! in_array($row->status, ['CREATED', 'REPLAYED', 'LINKED_EXISTING'], true))) {
                throw new ConflictHttpException('Source observation cannot be confirmed in its current state.');
            }
            $units = collect($input['items'])->keyBy('id');
            if (count($input['items']) !== $snapshot->items->count() || $units->count() !== $snapshot->items->count() || $units->keys()->map(fn ($id) => (int) $id)->sort()->values()->all() !== $snapshot->items->pluck('id')->sort()->values()->all()) {
                throw ValidationException::withMessages(['items' => 'Confirm exactly the existing snapshot items; quantities cannot be changed.']);
            }
            foreach ($snapshot->items as $item) {
                $unit = $units[$item->id]['unit'];
                if (! SnapshotBaselineSelector::validUnit($account, $unit) || ($item->unit !== 'UNKNOWN' && $item->unit !== $unit)) {
                    throw ValidationException::withMessages(['items' => 'Unit must be verified, provider-compatible, and cannot convert an existing known unit.']);
                }
                $item->update(['unit' => $unit]);
            }
            if ($input['coverage'] === 'FULL' && $snapshot->parsed_item_count !== $snapshot->items->count()) {
                throw ValidationException::withMessages(['coverage' => 'FULL requires a known complete parsed item count, including an explicitly empty statement.']);
            }
            $snapshot->update(['review_status' => 'CONFIRMED', 'coverage' => $input['coverage'], 'coverage_confirmed' => $input['coverage'] !== 'UNKNOWN']);
            DB::table('source_observations')->where('portfolio_snapshot_id', $snapshot->id)->update(['review_status' => 'CONFIRMED', 'updated_at' => now()]);
            $snapshot->refresh();
            $after = $this->selector->describe($snapshot, $account);
            // This is a metadata attestation. Original source structured_data and all quantities remain immutable.
            DB::table('integrity_audit_events')->insert([
                'investment_account_id' => $account->id, 'actor_id' => $actor, 'action' => 'SNAPSHOT_CONFIRMED',
                'source_document_id' => $snapshot->source_document_id, 'import_batch_id' => $observations->first()?->import_batch_id,
                'transaction_record_id' => null,
                'before_state' => json_encode(['reason' => 'USER_VERIFIED_SOURCE', 'snapshot' => $before], JSON_THROW_ON_ERROR),
                'after_state' => json_encode(['reason' => 'USER_VERIFIED_SOURCE', 'snapshot' => $after], JSON_THROW_ON_ERROR),
                'created_at' => now(),
            ]);

            return $after;
        });
    }
}
