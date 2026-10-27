<?php

namespace App\Services\Integrity;

use App\Models\InvestmentAccount;
use App\Models\PortfolioSnapshot;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

final class SourceImporter
{
    public static function digest(array $value): string
    {
        $sort = function ($v) use (&$sort) {
            if (! is_array($v)) {
                return $v;
            }
            if (! array_is_list($v)) {
                ksort($v);
            }

            return array_map($sort, $v);
        };

        return hash('sha256', json_encode($sort($value), JSON_THROW_ON_ERROR));
    }

    public function import(InvestmentAccount $account, int $actor, array $envelope, array $rows, ?array $snapshot): array
    {
        // Serialize imports and legacy writes per account on engines supporting row locks.
        return DB::transaction(function () use ($account, $actor, $envelope, $rows, $snapshot) {
            InvestmentAccount::whereKey($account->id)->lockForUpdate()->firstOrFail();
            $digest = self::digest(['source' => $envelope['source'], 'rows' => $rows, 'snapshot' => $snapshot]);
            $previous = DB::table('import_batches')->where('investment_account_id', $account->id)->where('idempotency_key', $envelope['idempotency_key'])->first();
            if ($previous) {
                if ($previous->payload_hash !== $digest) {
                    throw new ConflictHttpException('Idempotency key already used for a different payload.');
                }

                return [...json_decode($previous->receipt, true, 512, JSON_THROW_ON_ERROR), 'replayed' => true];
            }
            $meta = $envelope['source'];
            $source = DB::table('source_documents')->where('investment_account_id', $account->id)->where('document_hash', $meta['document_hash'])->first();
            if ($source) {
                foreach (['provider', 'source_type', 'document_type', 'parser_version'] as $field) {
                    if ($meta[$field] !== $source->$field) {
                        throw new ConflictHttpException('Existing document classification/version differs; review is required.');
                    }
                }
                $sourceId = $source->id;
                $sourcePublicId = $source->public_id;
            } else {
                $sourcePublicId = (string) Str::uuid();
                $sourceId = DB::table('source_documents')->insertGetId([
                    ...$meta, 'public_id' => $sourcePublicId, 'investment_account_id' => $account->id,
                    'imported_at' => now(), 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            $batchPublicId = (string) Str::uuid();
            $batchId = DB::table('import_batches')->insertGetId([
                'public_id' => $batchPublicId, 'investment_account_id' => $account->id,
                'source_document_id' => $sourceId, 'idempotency_key' => $envelope['idempotency_key'],
                'payload_hash' => $digest, 'created_at' => now(), 'updated_at' => now(),
            ]);
            $results = [];
            foreach ($rows as $row) {
                $key = 'tx_'.$row['row_key'];
                $payload = $row;
                unset($payload['match_transaction_id'], $payload['row_key'], $payload['confidence']);
                $rowHash = self::digest($payload);
                $old = DB::table('source_observations')->where('source_document_id', $sourceId)->where('row_key', $key)->first();
                if ($old) {
                    if ($old->payload_hash === $rowHash && $old->status === 'PENDING_REVIEW' && $row['match_transaction_id'] !== null) {
                        $target = Transaction::where('investment_account_id', $account->id)->find($row['match_transaction_id']);
                        if (! $target || ! TransactionIdentity::compatible($payload, $target->toArray())) {
                            throw ValidationException::withMessages(['match_transaction_id' => 'The confirmed target must be owned and financially compatible.']);
                        }
                        DB::table('source_observations')->where('id', $old->id)->update(['transaction_id' => $target->id, 'status' => 'LINKED_EXISTING', 'review_status' => 'CONFIRMED', 'updated_at' => now()]);
                        IntegrityAudit::record($account->id, $actor, 'SOURCE_LINK_CONFIRMED', $target->id, null, null, $sourceId, $batchId);
                        $results[] = ['row_key' => $row['row_key'], 'status' => 'LINKED_EXISTING', 'observation_id' => $old->id, 'transaction_id' => $target->id];

                        continue;
                    }
                    $replayStatus = $old->payload_hash !== $rowHash ? 'SOURCE_CONFLICT'
                        : ($old->review_status === 'REQUIRED' ? 'PENDING_REVIEW' : 'REPLAYED');
                    $results[] = ['row_key' => $row['row_key'], 'status' => $replayStatus, 'observation_id' => $old->id, 'transaction_id' => $old->transaction_id, 'review_status' => $old->review_status];

                    continue;
                }
                $candidates = TransactionWriter::candidates($payload);
                // A conflicting reference is also reviewable, even when fields differ.
                if ($payload['external_identifier'] ?? null) {
                    $byRef = Transaction::where('investment_account_id', $account->id)->where('external_identifier', $payload['external_identifier'])->get();
                    $candidates = $candidates->merge($byRef)->unique('id')->values();
                }
                $target = null;
                $status = 'PENDING_REVIEW';
                $needsUnitReview = in_array($row['type'], ['BUY', 'SELL'], true) && $row['unit'] === 'UNKNOWN';
                if ($row['match_transaction_id'] !== null) {
                    $target = Transaction::where('investment_account_id', $account->id)->find($row['match_transaction_id']);
                    if (! $target || ! TransactionIdentity::compatible($payload, $target->toArray())) {
                        throw ValidationException::withMessages(['match_transaction_id' => 'The confirmed target must be owned and financially compatible.']);
                    }
                    $status = 'LINKED_EXISTING';
                } elseif ($candidates->isEmpty()) {
                    $target = TransactionWriter::create($payload, $actor);
                    if (! $needsUnitReview) {
                        $target->update(['review_status' => 'CONFIRMED']);
                    }
                    $status = 'CREATED';
                }
                $observationId = DB::table('source_observations')->insertGetId([
                    'source_document_id' => $sourceId, 'import_batch_id' => $batchId,
                    'row_key' => $key, 'kind' => 'TRANSACTION', 'payload_hash' => $rowHash,
                    'structured_data' => json_encode($payload, JSON_THROW_ON_ERROR),
                    'transaction_id' => $target?->id, 'candidate_ids' => json_encode($candidates->pluck('id')->all()),
                    'confidence' => $row['confidence'], 'validation_status' => 'PASSED',
                    'review_status' => $status === 'PENDING_REVIEW' || $needsUnitReview ? 'REQUIRED' : 'CONFIRMED',
                    'status' => $status, 'created_at' => now(), 'updated_at' => now(),
                ]);
                $results[] = ['row_key' => $row['row_key'], 'status' => $status, 'review_status' => $status === 'PENDING_REVIEW' || $needsUnitReview ? 'REQUIRED' : 'CONFIRMED', 'observation_id' => $observationId, 'transaction_id' => $target?->id, 'candidate_ids' => $candidates->pluck('id')->all()];
                if ($status === 'LINKED_EXISTING') {
                    IntegrityAudit::record($account->id, $actor, 'SOURCE_LINK_CONFIRMED', $target->id, null, null, $sourceId, $batchId);
                }
            }
            if ($snapshot !== null) {
                $results[] = $this->snapshot($snapshot, $sourceId, $batchId);
            }
            $receipt = ['batch_id' => $batchPublicId, 'source_document_id' => $sourcePublicId, 'replayed' => false, 'results' => $results];
            DB::table('import_batches')->where('id', $batchId)->update(['receipt' => json_encode($receipt, JSON_THROW_ON_ERROR)]);
            IntegrityAudit::record($account->id, $actor, 'SOURCE_IMPORT_CONFIRMED', null, null, null, $sourceId, $batchId);

            return $receipt;
        }, 3);
    }

    private function snapshot(array $data, int $sourceId, int $batchId): array
    {
        $hash = self::digest($data);
        $old = DB::table('source_observations')->where('source_document_id', $sourceId)->where('row_key', 'snapshot')->first();
        if ($old) {
            return ['row_key' => 'snapshot', 'status' => $old->payload_hash !== $hash ? 'SOURCE_CONFLICT' : ($old->status === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : 'REPLAYED'), 'review_status' => $old->review_status, 'snapshot_id' => $old->portfolio_snapshot_id, 'observation_id' => $old->id];
        }
        $conflict = PortfolioSnapshot::where('investment_account_id', $data['investment_account_id'])->whereDate('as_of_date', $data['as_of_date'])->exists();
        $items = $data['items'];
        unset($data['items']);
        $snapshot = PortfolioSnapshot::create([...$data, 'source_document_id' => $sourceId, 'snapshot_hash' => self::digest([$sourceId, $hash])]);
        foreach ($items as $item) {
            $snapshot->items()->create($item);
        }
        $id = DB::table('source_observations')->insertGetId([
            'source_document_id' => $sourceId, 'import_batch_id' => $batchId, 'row_key' => 'snapshot',
            'kind' => 'SNAPSHOT', 'payload_hash' => $hash, 'structured_data' => json_encode([...$data, 'items' => $items], JSON_THROW_ON_ERROR),
            'portfolio_snapshot_id' => $snapshot->id, 'validation_status' => 'PASSED', 'review_status' => 'REQUIRED',
            'status' => $conflict ? 'PENDING_REVIEW' : 'CREATED', 'created_at' => now(), 'updated_at' => now(),
        ]);

        return ['row_key' => 'snapshot', 'status' => $conflict ? 'PENDING_REVIEW' : 'CREATED', 'review_status' => 'REQUIRED', 'snapshot_id' => $snapshot->id, 'observation_id' => $id, 'coverage' => $snapshot->coverage];
    }
}
