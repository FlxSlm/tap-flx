<?php

namespace Tests\Unit;

use App\Services\Integrity\Decimal;
use App\Services\Integrity\TransactionIdentity;
use PHPUnit\Framework\TestCase;

class TransactionIdentityTest extends TestCase
{
    public function test_exact_decimal_arithmetic_and_normalization(): void
    {
        $this->assertSame('0.3', Decimal::add('0.1', '0.2'));
        $this->assertSame('10000000000000000000', Decimal::add('9999999999999999999.9', '0.1'));
        $this->assertSame('1', Decimal::normalize('0001.0000'));
        $this->assertSame('0.00000002', Decimal::multiply('0.00000001', '2'));
        $this->assertSame('15241.383936', Decimal::multiply('123.456', '123.456'));
    }

    public function test_identity_preserves_currency_time_and_reference_and_normalizes_decimals(): void
    {
        $data = ['investment_account_id' => 1, 'transaction_date' => '2020-01-02T01:00:00Z', 'type' => 'BUY', 'symbol' => 'TSTA', 'quantity' => '1.00', 'price' => '100', 'total_amount' => '100', 'currency' => 'IDR'];
        $hash = TransactionIdentity::hash($data);
        $this->assertSame($hash, TransactionIdentity::hash([...$data, 'quantity' => '01.000']));
        $this->assertSame($hash, TransactionIdentity::hash([...$data, 'investment_account_id' => '1']));
        foreach (['currency' => 'USD', 'transaction_date' => '2020-01-02T02:00:00Z', 'external_identifier' => 'SYNTHETIC-REF-2'] as $field => $value) {
            $this->assertNotSame($hash, TransactionIdentity::hash([...$data, $field => $value]));
        }
    }
}
