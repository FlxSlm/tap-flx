<?php

namespace App\Services\Holdings;

use App\Models\InvestmentAccount;
use App\Models\Transaction;
use App\Services\Integrity\Decimal;
use App\Services\Integrity\SourceImporter;
use App\Services\Integrity\TransactionIdentity;
use Illuminate\Support\Facades\DB;

final class HoldingsProjectionService
{
    public function __construct(private SnapshotBaselineSelector $selector, private HoldingsCoverageEvaluator $coverage) {}

    public function project(InvestmentAccount $account, string $asOf, ?int $baselineId, ?string $timezone, ?string $cutoff): HoldingsCalculationResult
    {
        $selection = $this->selector->select($account, $baselineId, $asOf);
        $baseline = $selection['snapshot'];
        $transactions = Transaction::where('investment_account_id', $account->id)->orderBy('transaction_date')->orderBy('id')->get();
        $observations = DB::table('source_observations as observations')->join('source_documents as sources', 'sources.id', '=', 'observations.source_document_id')
            ->where('sources.investment_account_id', $account->id)->orderBy('observations.id')->select('observations.*')->get();
        $windowInfo = ['opening_exclusive' => $baseline['as_of_date'] ?? null, 'as_of_inclusive' => $asOf, 'timezone' => $timezone, 'cutoff' => $cutoff];
        $version = SourceImporter::digest(['holdings-v1', $account->id, $baseline, $windowInfo,
            $transactions->map(fn ($tx) => $tx->getAttributes())->all(), $observations->toArray()]);
        if ($selection['reasons'] !== []) {
            return new HoldingsCalculationResult('INCOMPLETE', $selection['reasons'], $baseline, [], $version, $windowInfo, []);
        }
        $window = new EffectiveDateWindow($baseline['as_of_date'], $asOf, $timezone, $cutoff);
        $coverageReasons = $this->coverage->reasons($baseline, $asOf);
        $groups = [];
        $assetBlocks = [];
        $globalBlocks = [];
        $excluded = [];
        $blockedIds = [];
        $ensure = function (string $symbol, string $unit) use (&$groups, $baseline): string {
            $key = $symbol.'|'.$unit;
            if (! isset($groups[$key])) {
                $opening = collect($baseline['items'])->first(fn ($item) => $item['symbol'] === $symbol && $item['unit'] === $unit);
                $groups[$key] = [
                    'symbol' => $symbol, 'unit' => $unit,
                    'opening_quantity' => $opening['quantity'] ?? ($baseline['coverage'] === 'FULL' && $baseline['coverage_confirmed'] ? '0' : null),
                    'buy_quantity' => '0', 'sell_quantity' => '0', 'transaction_ids' => [], 'reasons' => [],
                ];
            }

            return $key;
        };
        foreach ($baseline['items'] as $item) {
            $ensure($item['symbol'], $item['unit']);
        }
        $identities = [];
        foreach ($transactions as $tx) {
            if ($tx->validation_status !== 'PASSED' || $tx->review_status !== 'CONFIRMED' || ! in_array($tx->type, ['BUY', 'SELL'], true) || $window->contains($tx->getAttributes()) !== true) {
                continue;
            }
            try {
                $identity = TransactionIdentity::hash($tx->toArray());
                if (isset($identities[$identity])) {
                    $blockedIds[$tx->id] = $blockedIds[$identities[$identity]] = true;
                } else {
                    $identities[$identity] = $tx->id;
                }
            } catch (\Throwable) {
                // Critical quantity/unit/date validity is evaluated below; invalid legacy identity is never a match.
            }
        }
        foreach ($observations as $observation) {
            if ($observation->kind !== 'TRANSACTION') {
                continue;
            }
            $unresolved = $observation->review_status !== 'CONFIRMED' || $observation->validation_status !== 'PASSED'
                || ! in_array($observation->status, ['CREATED', 'LINKED_EXISTING', 'REPLAYED'], true);
            if (! $unresolved) {
                continue;
            }
            $data = json_decode($observation->structured_data, true, 512, JSON_THROW_ON_ERROR);
            if ($window->contains($data) === false) {
                continue;
            }
            if (! $this->quantityRelevant($data)) {
                continue;
            }
            $symbol = strtoupper($data['symbol'] ?? '');
            $reason = 'UNRESOLVED_SOURCE_OBSERVATION';
            if ($symbol !== '') {
                $assetBlocks[$symbol][] = $reason;
                $ensure($symbol, $data['unit'] ?? 'UNKNOWN');
            } else {
                $globalBlocks[] = $reason;
            }
            foreach (json_decode($observation->candidate_ids ?? '[]', true, 512, JSON_THROW_ON_ERROR) as $id) {
                $blockedIds[(int) $id] = true;
            }
            if ($observation->transaction_id !== null) {
                $blockedIds[(int) $observation->transaction_id] = true;
            }
            $excluded[] = ['observation_id' => $observation->id, 'reason' => $reason];
        }
        foreach ($transactions as $tx) {
            $event = $tx->getAttributes();
            $membership = $window->contains($event);
            if ($membership === false) {
                continue;
            }
            $quantityEvent = in_array($tx->type, ['BUY', 'SELL'], true);
            $unsupported = ! $quantityEvent;
            if (! $this->quantityRelevant($event)) {
                // Cash dividends (including reference balance) never change asset quantity.
                continue;
            }
            $symbol = strtoupper($tx->symbol ?? '');
            if ($symbol === '' || ! preg_match('/^[A-Z0-9._-]{1,30}$/D', $symbol)) {
                $globalBlocks[] = 'UNKNOWN_ASSET_FOR_QUANTITY_EVENT';
                $excluded[] = ['transaction_id' => $tx->id, 'reason' => 'UNKNOWN_ASSET_FOR_QUANTITY_EVENT'];

                continue;
            }
            $unit = $tx->unit ?? 'UNKNOWN';
            $key = $ensure($symbol, $unit);
            $reason = match (true) {
                $membership === null => 'AMBIGUOUS_EFFECTIVE_TIME',
                $tx->validation_status !== 'PASSED' => 'TRANSACTION_NOT_VALIDATED',
                $tx->review_status !== 'CONFIRMED' => 'TRANSACTION_REQUIRES_REVIEW',
                isset($blockedIds[$tx->id]) => 'UNRESOLVED_DUPLICATE_CANDIDATE',
                ! SnapshotBaselineSelector::validUnit($account, $unit) => 'UNKNOWN_OR_INVALID_TRANSACTION_UNIT',
                $unsupported => 'UNSUPPORTED_QUANTITY_EVENT',
                default => null,
            };
            try {
                $quantity = QuantityDecimal::normalize($tx->quantity);
                if ($quantity === '0') {
                    $reason ??= 'INVALID_TRANSACTION_QUANTITY';
                }
            } catch (\Throwable) {
                $quantity = null;
                $reason ??= 'INVALID_TRANSACTION_QUANTITY';
            }
            if ($reason !== null) {
                $assetBlocks[$symbol][] = $reason;
                $excluded[] = ['transaction_id' => $tx->id, 'reason' => $reason];

                continue;
            }
            $field = $tx->type === 'BUY' ? 'buy_quantity' : 'sell_quantity';
            $groups[$key][$field] = Decimal::add($groups[$key][$field], $quantity);
            $groups[$key]['transaction_ids'][] = $tx->id;
        }
        $items = [];
        $reasons = [...$coverageReasons, ...$globalBlocks];
        foreach ($groups as $group) {
            $rowReasons = [...$globalBlocks, ...($assetBlocks[$group['symbol']] ?? [])];
            if (collect($groups)->where('symbol', $group['symbol'])->count() > 1) {
                $rowReasons[] = 'INCOMPATIBLE_UNITS_FOR_SYMBOL';
            }
            if ($group['opening_quantity'] === null) {
                $rowReasons[] = 'OPENING_QUANTITY_UNKNOWN';
            }
            $quantity = $rowReasons === [] ? QuantityDecimal::subtract(Decimal::add($group['opening_quantity'], $group['buy_quantity']), $group['sell_quantity']) : null;
            if ($quantity !== null && str_starts_with($quantity, '-')) {
                $rowReasons[] = 'NEGATIVE_POSITION_REQUIRES_REVIEW';
                $quantity = null;
            }
            $rowReasons = array_values(array_unique([...$rowReasons, ...$coverageReasons]));
            $items[] = [...$group, 'quantity' => $quantity, 'status' => $rowReasons === [] ? 'COMPLETE' : 'INCOMPLETE', 'reasons' => $rowReasons];
            $reasons = [...$reasons, ...$rowReasons];
        }
        usort($items, fn ($a, $b) => [$a['symbol'], $a['unit']] <=> [$b['symbol'], $b['unit']]);
        $reasons = array_values(array_unique($reasons));

        return new HoldingsCalculationResult($reasons === [] ? 'COMPLETE' : 'INCOMPLETE', $reasons, $baseline, $items, $version, $windowInfo, $excluded);
    }

    private function quantityRelevant(array $event): bool
    {
        if (($event['type'] ?? '') === 'DIVIDEND') {
            return false;
        }
        if (! in_array($event['type'] ?? '', ['FEE', 'DEPOSIT', 'WITHDRAWAL'], true)) {
            return true;
        }

        return ($event['quantity'] ?? null) !== null || ! empty($event['symbol']);
    }
}
