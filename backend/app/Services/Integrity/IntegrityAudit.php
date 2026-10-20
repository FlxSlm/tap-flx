<?php

namespace App\Services\Integrity;

use Illuminate\Support\Facades\DB;

final class IntegrityAudit
{
    public static function record(int $accountId, int $actorId, string $action, ?int $transactionId, ?array $before, ?array $after, ?int $sourceId = null, ?int $batchId = null): void
    {
        $safe = fn ($state) => $state === null ? null : json_encode(array_intersect_key($state, array_flip([...TransactionIdentity::FIELDS, 'transaction_hash', 'revision', 'validation_status', 'review_status'])), JSON_THROW_ON_ERROR);
        DB::table('integrity_audit_events')->insert([
            'investment_account_id' => $accountId,
            'actor_id' => $actorId,
            'action' => $action,
            'transaction_record_id' => $transactionId,
            'source_document_id' => $sourceId,
            'import_batch_id' => $batchId,
            'before_state' => $safe($before),
            'after_state' => $safe($after),
            'created_at' => now(),
        ]);
    }
}
