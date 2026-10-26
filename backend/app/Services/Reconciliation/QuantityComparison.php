<?php

namespace App\Services\Reconciliation;

use App\Services\Holdings\QuantityDecimal;

/** Numerical diagnostics only. Evidence policy assigns reconciliation statuses separately. */
final class QuantityComparison
{
    public function compare(array $projection, array $closing, array $validUnits): array
    {
        $opening = $projection['baseline'];
        $openingItems = $this->index($opening['items'] ?? []);
        $calculatedItems = $this->index($projection['items']);
        $closingItems = $this->index($closing['items']);
        $keys = array_values(array_unique([...array_keys($openingItems), ...array_keys($calculatedItems), ...array_keys($closingItems)]));
        sort($keys, SORT_STRING);
        $units = [];
        foreach ($keys as $key) {
            [$symbol, $unit] = explode('|', $key, 2);
            $units[$symbol][$unit] = true;
        }
        $openingValid = $opening !== null && $opening['baseline_issues'] === [];
        $closingValid = $closing['baseline_issues'] === [];
        $openingFull = $openingValid && $opening['coverage'] === 'FULL' && $opening['coverage_confirmed'];
        $closingFull = $closingValid && $closing['coverage'] === 'FULL' && $closing['coverage_confirmed'];
        $projectionCritical = array_diff($projection['reasons'], ['ACTIVITY_COVERAGE_UNKNOWN']);
        $rows = [];
        foreach ($keys as $key) {
            [$symbol, $unit] = explode('|', $key, 2);
            $projected = $calculatedItems[$key] ?? null;
            $unitValid = in_array($unit, $validUnits, true) && count($units[$symbol]) === 1;
            $openingQuantity = $openingItems[$key]['quantity'] ?? ($openingFull && $unitValid ? '0' : null);
            $reportedQuantity = $closingItems[$key]['quantity'] ?? ($closingFull && $unitValid ? '0' : null);
            $calculatedQuantity = $projected !== null ? $projected['quantity'] : ($openingFull && $projectionCritical === [] ? '0' : null);
            $reasons = [];
            if (! in_array($unit, $validUnits, true)) {
                $reasons[] = 'UNIT_UNKNOWN_OR_INVALID';
            }
            if (count($units[$symbol]) !== 1) {
                $reasons[] = 'INCOMPATIBLE_UNITS_FOR_SYMBOL';
            }
            if ($reportedQuantity === null) {
                $reasons[] = 'REPORTED_QUANTITY_UNKNOWN';
            }
            if ($calculatedQuantity === null) {
                $reasons[] = 'CALCULATED_QUANTITY_UNKNOWN';
            }
            $comparable = $unitValid && $openingValid && $closingValid;
            if (! $comparable) {
                $calculatedQuantity = null;
            }
            $difference = $comparable && $reportedQuantity !== null && $calculatedQuantity !== null
                ? QuantityDecimal::subtract($reportedQuantity, $calculatedQuantity) : null;
            $observedChange = $comparable && $openingQuantity !== null && $reportedQuantity !== null
                ? QuantityDecimal::subtract($reportedQuantity, $openingQuantity) : null;
            $rows[] = [
                'symbol' => $symbol, 'unit' => $unit,
                'opening_quantity' => $openingQuantity,
                'accepted_buy_quantity' => $projected['buy_quantity'] ?? '0',
                'accepted_sell_quantity' => $projected['sell_quantity'] ?? '0',
                'calculated_quantity' => $calculatedQuantity, 'reported_quantity' => $reportedQuantity,
                'difference' => $difference, 'observed_position_change' => $observedChange,
                'observed_change_basis' => 'POSITION_CHANGE_NOT_TRADE_ACTIVITY',
                'numerical_comparison' => $difference === null ? 'NOT_COMPARABLE' : ($difference === '0' ? 'EQUAL' : 'DIFFERENT'),
                'transaction_ids' => $projected['transaction_ids'] ?? [],
                'projection_reasons' => $projected['reasons'] ?? $projection['reasons'],
                'comparison_reasons' => $reasons,
                'opening_absence_inferred_zero' => ! isset($openingItems[$key]) && $openingQuantity === '0',
                'closing_absence_inferred_zero' => ! isset($closingItems[$key]) && $reportedQuantity === '0',
            ];
        }

        return $rows;
    }

    private function index(array $items): array
    {
        $result = [];
        foreach ($items as $item) {
            $result[$item['symbol'].'|'.$item['unit']] = $item;
        }

        return $result;
    }
}
