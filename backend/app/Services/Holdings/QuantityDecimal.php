<?php

namespace App\Services\Holdings;

use App\Services\Integrity\Decimal;
use InvalidArgumentException;

final class QuantityDecimal
{
    public static function normalize(mixed $value): string
    {
        if (! is_string($value) || ! preg_match('/^\d{1,16}(?:\.\d{1,8})?$/D', $value)) {
            throw new InvalidArgumentException('Quantity requires a nonnegative decimal string with at most eight decimals.');
        }

        return Decimal::normalize($value);
    }

    /** Signed subtraction using decimal digits only. Input sums may exceed storage precision. */
    public static function subtract(string $left, string $right): string
    {
        $scale = max(strlen(explode('.', $left)[1] ?? ''), strlen(explode('.', $right)[1] ?? ''));
        $digits = static function (string $value) use ($scale): string {
            [$whole, $fraction] = array_pad(explode('.', $value), 2, '');

            return ltrim($whole.str_pad($fraction, $scale, '0'), '0') ?: '0';
        };
        $a = $digits($left);
        $b = $digits($right);
        $comparison = strlen($a) <=> strlen($b);
        $comparison = $comparison ?: strcmp($a, $b);
        $negative = $comparison < 0;
        if ($negative) {
            [$a, $b] = [$b, $a];
        }
        $a = strrev($a);
        $b = strrev($b);
        $borrow = 0;
        $result = '';
        for ($i = 0; $i < strlen($a); $i++) {
            $digit = (int) $a[$i] - (int) ($b[$i] ?? '0') - $borrow;
            $borrow = $digit < 0 ? 1 : 0;
            $result .= (string) (($digit + 10) % 10);
        }
        $result = str_pad(strrev($result), $scale + 1, '0', STR_PAD_LEFT);
        $result = Decimal::normalize($scale ? substr($result, 0, -$scale).'.'.substr($result, -$scale) : $result);

        return ($negative && $result !== '0' ? '-' : '').$result;
    }
}
