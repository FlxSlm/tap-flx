<?php

namespace Tests\Unit;

use App\Services\Holdings\QuantityDecimal;
use App\Services\Integrity\Decimal;
use PHPUnit\Framework\TestCase;

class QuantityDecimalTest extends TestCase
{
    public function test_large_and_fractional_quantities_remain_exact_without_float(): void
    {
        $opening = QuantityDecimal::normalize('9999999999999999.99999998');
        $this->assertSame('9999999999999999.99999999', QuantityDecimal::subtract(Decimal::add($opening, '0.00000002'), '0.00000001'));
        $this->assertSame('0', QuantityDecimal::subtract('0.1', '0.10000000'));
        $this->assertSame('-0.00000001', QuantityDecimal::subtract('0.1', '0.10000001'));
        $this->assertSame('9999999999999999.1', QuantityDecimal::subtract('10000000000000000', '0.9'));
    }

    public function test_excess_precision_is_rejected_instead_of_rounded(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        QuantityDecimal::normalize('0.000000001');
    }

    public function test_null_is_not_zero(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        QuantityDecimal::normalize(null);
    }
}
