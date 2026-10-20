<?php

namespace App\Services\Integrity;

use App\Models\InvestmentAccount;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

final class TransactionWriter
{
    public static function candidates(array $data, ?int $except = null)
    {
        return Transaction::where('investment_account_id', $data['investment_account_id'])
            ->whereDate('transaction_date', substr($data['transaction_date'], 0, 10))
            ->where('type', $data['type'])
            ->when($except, fn ($q) => $q->where('id', '!=', $except))
            ->get()->filter(fn ($tx) => TransactionIdentity::potentialMatch($data, $tx->toArray()))->values();
    }

    public static function create(array $data, int $actorId): Transaction
    {
        return DB::transaction(function () use ($data, $actorId) {
            InvestmentAccount::whereKey($data['investment_account_id'])->lockForUpdate()->firstOrFail();
            $hash = TransactionIdentity::hash($data);
            // Include legacy hashes through field comparison; never rewrite historic rows in bulk.
            $duplicate = self::candidates($data)->first(fn ($tx) => self::hasIdentity($tx, $hash));
            if ($duplicate) {
                throw new ConflictHttpException('Duplicate transaction detected.');
            }
            $tx = Transaction::create([...$data, 'transaction_hash' => $hash, 'imported_at' => now(), 'validation_status' => 'PASSED', 'review_status' => 'REQUIRED']);
            IntegrityAudit::record($tx->investment_account_id, $actorId, 'TRANSACTION_CREATED', $tx->id, null, $tx->toArray());

            return $tx;
        });
    }

    public static function update(Transaction $transaction, array $patch, int $actorId): Transaction
    {
        return DB::transaction(function () use ($transaction, $patch, $actorId) {
            InvestmentAccount::whereKey($transaction->investment_account_id)->lockForUpdate()->firstOrFail();
            $tx = Transaction::whereKey($transaction->id)->lockForUpdate()->firstOrFail();
            $before = $tx->toArray();
            $data = TransactionContract::validate([...$before, 'transaction_date' => $tx->transaction_date->format('Y-m-d H:i:s'), ...$patch]);
            $hash = TransactionIdentity::hash($data);
            if (self::candidates($data, $tx->id)->contains(fn ($other) => self::hasIdentity($other, $hash))) {
                throw new ConflictHttpException('Duplicate transaction detected.');
            }
            $tx->fill([...$data, 'transaction_hash' => $hash, 'revision' => $tx->revision + 1, 'validation_status' => 'PASSED', 'review_status' => 'REQUIRED']);
            $tx->save();
            // Keep source evidence immutable, but mark its current link as needing re-review.
            DB::table('source_observations')->where('transaction_id', $tx->id)->update(['review_status' => 'REQUIRED', 'updated_at' => now()]);
            IntegrityAudit::record($tx->investment_account_id, $actorId, 'TRANSACTION_UPDATED', $tx->id, $before, $tx->toArray());

            return $tx;
        });
    }

    public static function delete(Transaction $tx, int $actorId): void
    {
        DB::transaction(function () use ($tx, $actorId) {
            InvestmentAccount::whereKey($tx->investment_account_id)->lockForUpdate()->firstOrFail();
            $current = Transaction::whereKey($tx->id)->lockForUpdate()->firstOrFail();
            IntegrityAudit::record($current->investment_account_id, $actorId, 'TRANSACTION_DELETED', $current->id, $current->toArray(), null);
            DB::table('source_observations')->where('transaction_id', $current->id)->update(['status' => 'TARGET_DELETED', 'review_status' => 'REQUIRED', 'updated_at' => now()]);
            $current->delete();
        });
    }

    private static function hasIdentity(Transaction $tx, string $hash): bool
    {
        try {
            return TransactionIdentity::hash($tx->toArray()) === $hash;
        } catch (\InvalidArgumentException) {
            return false;
        }
    }
}
