<?php

namespace App\Services\Integrity;

use Carbon\CarbonImmutable;

final class TransactionIdentity
{
    public const FIELDS = ['investment_account_id', 'transaction_date', 'date_precision', 'type', 'symbol', 'unit', 'quantity', 'reference_quantity', 'price', 'currency', 'total_amount', 'amount_semantics', 'gross_amount', 'net_amount', 'fee_amount', 'tax_amount', 'settlement_amount', 'external_identifier'];

    public static function canonicalize(array $data): array
    {
        $data['investment_account_id'] = (int) $data['investment_account_id'];
        $data['symbol'] = isset($data['symbol']) ? strtoupper(trim($data['symbol'])) : null;
        $data['type'] = strtoupper($data['type']);
        $data['currency'] = strtoupper($data['currency'] ?? 'IDR');
        $data['unit'] ??= 'UNKNOWN';
        $data['date_precision'] ??= 'TIMESTAMP';
        $data['amount_semantics'] ??= 'UNKNOWN';
        $date = CarbonImmutable::parse($data['transaction_date']);
        $data['transaction_date'] = $data['date_precision'] === 'DATE'
            ? $date->format('Y-m-d').' 00:00:00' : $date->utc()->format('Y-m-d H:i:s');
        foreach (['quantity', 'reference_quantity', 'price', 'total_amount', 'gross_amount', 'net_amount', 'fee_amount', 'tax_amount', 'settlement_amount'] as $field) {
            $data[$field] = Decimal::normalize($data[$field] ?? null);
        }

        return $data;
    }

    public static function hash(array $data): string
    {
        $data = self::canonicalize($data);
        $identity = array_map(fn ($key) => $data[$key] ?? null, self::FIELDS);

        return hash('sha256', json_encode(['integrity-v1', $identity], JSON_THROW_ON_ERROR));
    }

    /** Conservative candidate search. A compatible candidate is NOT automatic proof of identity. */
    public static function compatible(array $left, array $right): bool
    {
        return self::compare($left, $right, true);
    }

    public static function potentialMatch(array $left, array $right): bool
    {
        // Financial disagreements are review evidence, not proof that two sources are distinct trades.
        return self::compare($left, $right, false);
    }

    private static function compare(array $left, array $right, bool $strictAmounts): bool
    {
        try {
            $left = self::canonicalize($left);
            $right = self::canonicalize($right);
        } catch (\InvalidArgumentException) {
            // Invalid legacy financial values must not crash new imports or be auto-linked.
            if ($strictAmounts) {
                return false;
            }
            foreach (['investment_account_id', 'type', 'symbol', 'currency'] as $field) {
                if (strtoupper((string) ($left[$field] ?? '')) !== strtoupper((string) ($right[$field] ?? ''))) {
                    return false;
                }
            }

            return substr((string) $left['transaction_date'], 0, 10) === substr((string) $right['transaction_date'], 0, 10);
        }
        foreach (['investment_account_id', 'type', 'symbol', 'currency'] as $field) {
            if ((string) ($left[$field] ?? '') !== (string) ($right[$field] ?? '')) {
                return false;
            }
        }
        if (substr($left['transaction_date'], 0, 10) !== substr($right['transaction_date'], 0, 10)) {
            return false;
        }
        if ($left['date_precision'] === 'TIMESTAMP' && $right['date_precision'] === 'TIMESTAMP'
            && $left['transaction_date'] !== $right['transaction_date']) {
            return false;
        }
        if ($left['unit'] !== 'UNKNOWN' && $right['unit'] !== 'UNKNOWN' && $left['unit'] !== $right['unit']) {
            return false;
        }
        $fields = $strictAmounts ? ['quantity', 'price', 'gross_amount', 'net_amount', 'settlement_amount', 'reference_quantity', 'fee_amount', 'tax_amount'] : ['quantity', 'price'];
        foreach ($fields as $field) {
            if ($left[$field] !== null && $right[$field] !== null && $left[$field] !== $right[$field]) {
                return false;
            }
        }
        if ($strictAmounts && $left['amount_semantics'] !== 'UNKNOWN' && $left['amount_semantics'] === $right['amount_semantics']
            && $left['total_amount'] !== $right['total_amount']) {
            return false;
        }

        return true;
    }
}
