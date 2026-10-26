<?php

namespace App\Services\Holdings;

use Carbon\CarbonImmutable;

final class EffectiveDateWindow
{
    public function __construct(
        public readonly string $openingDate,
        public readonly string $asOf,
        public readonly ?string $timezone = null,
        public readonly ?string $cutoff = null,
    ) {}

    /** null means timestamp membership cannot be established without an explicit boundary. */
    public function contains(array $event): ?bool
    {
        if ($this->openingDate === $this->asOf) {
            return false;
        }
        $value = (string) ($event['transaction_date'] ?? '');
        $day = substr($value, 0, 10);
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/D', $day)) {
            return null;
        }
        if (($event['date_precision'] ?? null) === 'DATE') {
            return $day > $this->openingDate && $day <= $this->asOf;
        }
        if (($event['date_precision'] ?? null) !== 'TIMESTAMP') {
            return null;
        }
        if ($this->timezone === null || $this->cutoff === null) {
            // Include possible boundary events conservatively; never guess a broker timezone.
            $lower = CarbonImmutable::parse($this->openingDate, 'UTC')->subDays(2)->format('Y-m-d');
            $upper = CarbonImmutable::parse($this->asOf, 'UTC')->addDays(2)->format('Y-m-d');

            return ($day < $lower || $day > $upper) ? false : null;
        }
        try {
            $time = CarbonImmutable::parse($value, 'UTC');
            $start = CarbonImmutable::parse($this->openingDate.' '.$this->cutoff, $this->timezone)->utc();
            $end = CarbonImmutable::parse($this->asOf.' '.$this->cutoff, $this->timezone)->utc();

            return $time->greaterThan($start) && $time->lessThanOrEqualTo($end);
        } catch (\Throwable) {
            return null;
        }
    }
}
