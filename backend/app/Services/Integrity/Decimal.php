<?php

namespace App\Services\Integrity;

final class Decimal
{
    public static function normalize(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $value = (string) $value;
        if (! preg_match('/^\d+(?:\.\d+)?$/D', $value)) {
            throw new \InvalidArgumentException('Expected a nonnegative plain decimal.');
        }
        [$whole, $fraction] = array_pad(explode('.', $value, 2), 2, '');
        $whole = ltrim($whole, '0') ?: '0';
        $fraction = rtrim($fraction, '0');

        return $whole.($fraction === '' ? '' : '.'.$fraction);
    }

    /** Exact nonnegative decimal addition, without float or extension dependencies. */
    public static function add(string ...$values): string
    {
        $scale = max(array_map(fn ($v) => strlen(explode('.', $v)[1] ?? ''), $values));
        $sum = '0';
        foreach ($values as $value) {
            [$whole, $fraction] = array_pad(explode('.', $value, 2), 2, '');
            $digits = strrev($whole.str_pad($fraction, $scale, '0'));
            $previous = strrev($sum);
            $carry = 0;
            $result = '';
            for ($i = 0; $i < max(strlen($digits), strlen($previous)); $i++) {
                $digit = (int) ($digits[$i] ?? 0) + (int) ($previous[$i] ?? 0) + $carry;
                $result .= $digit % 10;
                $carry = intdiv($digit, 10);
            }
            $sum = strrev($result.($carry ? (string) $carry : ''));
        }
        $sum = str_pad($sum, $scale + 1, '0', STR_PAD_LEFT);

        return self::normalize($scale ? substr($sum, 0, -$scale).'.'.substr($sum, -$scale) : $sum);
    }

    public static function multiply(string $left, string $right): string
    {
        $scale = strlen(explode('.', $left)[1] ?? '') + strlen(explode('.', $right)[1] ?? '');
        $a = strrev(str_replace('.', '', $left));
        $b = strrev(str_replace('.', '', $right));
        $digits = array_fill(0, strlen($a) + strlen($b) + 1, 0);
        for ($i = 0; $i < strlen($a); $i++) {
            for ($j = 0; $j < strlen($b); $j++) {
                $digits[$i + $j] += (int) $a[$i] * (int) $b[$j];
            }
        }
        for ($i = 0; $i < count($digits) - 1; $i++) {
            $digits[$i + 1] += intdiv($digits[$i], 10);
            $digits[$i] %= 10;
        }
        $value = str_pad(ltrim(implode('', array_reverse($digits)), '0') ?: '0', $scale + 1, '0', STR_PAD_LEFT);

        return self::normalize($scale ? substr($value, 0, -$scale).'.'.substr($value, -$scale) : $value);
    }
}
