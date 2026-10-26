<?php

namespace Tests\Unit;

use App\Services\Reconciliation\QuantityComparison;
use PHPUnit\Framework\TestCase;

class QuantityComparisonTest extends TestCase
{
    private function snapshot(array $items, string $coverage = 'FULL'): array
    {
        return ['items' => $items, 'coverage' => $coverage, 'coverage_confirmed' => true, 'baseline_issues' => []];
    }

    public function test_difference_is_reported_minus_calculated_using_exact_decimal_and_not_a_status(): void
    {
        $projection = [
            'baseline' => $this->snapshot([['symbol' => 'TSTC', 'unit' => 'COIN', 'quantity' => '0.1']]),
            'items' => [['symbol' => 'TSTC', 'unit' => 'COIN', 'quantity' => '0.10000001', 'buy_quantity' => '0.00000001', 'sell_quantity' => '0', 'transaction_ids' => [1], 'reasons' => ['ACTIVITY_COVERAGE_UNKNOWN']]],
            'reasons' => ['ACTIVITY_COVERAGE_UNKNOWN'],
        ];
        $closing = $this->snapshot([['symbol' => 'TSTC', 'unit' => 'COIN', 'quantity' => '0.1']]);
        $row = (new QuantityComparison)->compare($projection, $closing, ['COIN'])[0];
        $this->assertSame('-0.00000001', $row['difference']);
        $this->assertSame('DIFFERENT', $row['numerical_comparison']);
        $this->assertArrayNotHasKey('status', $row);
        $this->assertSame('0', $row['observed_position_change']);
    }

    public function test_missing_symbol_is_zero_only_when_snapshot_universe_is_full(): void
    {
        $projection = [
            'baseline' => $this->snapshot([['symbol' => 'TSTA', 'unit' => 'SHARE', 'quantity' => '100']]),
            'items' => [['symbol' => 'TSTA', 'unit' => 'SHARE', 'quantity' => '0', 'buy_quantity' => '0', 'sell_quantity' => '100', 'transaction_ids' => [1], 'reasons' => []]],
            'reasons' => [],
        ];
        $comparison = new QuantityComparison;
        $full = $comparison->compare($projection, $this->snapshot([]), ['SHARE'])[0];
        $partial = $comparison->compare($projection, $this->snapshot([], 'PARTIAL'), ['SHARE'])[0];
        $this->assertSame('0', $full['reported_quantity']);
        $this->assertSame('0', $full['difference']);
        $this->assertNull($partial['reported_quantity']);
        $this->assertNull($partial['difference']);
        $this->assertSame('NOT_COMPARABLE', $partial['numerical_comparison']);
    }

    public function test_different_units_cannot_be_subtracted_or_silently_converted(): void
    {
        $projection = [
            'baseline' => $this->snapshot([['symbol' => 'TSTA', 'unit' => 'LOT', 'quantity' => '1']]),
            'items' => [['symbol' => 'TSTA', 'unit' => 'LOT', 'quantity' => '1', 'reasons' => []]],
            'reasons' => [],
        ];
        $closing = $this->snapshot([['symbol' => 'TSTA', 'unit' => 'SHARE', 'quantity' => '100']]);
        $rows = (new QuantityComparison)->compare($projection, $closing, ['LOT', 'SHARE']);
        $this->assertCount(2, $rows);
        foreach ($rows as $row) {
            $this->assertNull($row['difference']);
            $this->assertNull($row['observed_position_change']);
            $this->assertContains('INCOMPATIBLE_UNITS_FOR_SYMBOL', $row['comparison_reasons']);
        }
    }
}
