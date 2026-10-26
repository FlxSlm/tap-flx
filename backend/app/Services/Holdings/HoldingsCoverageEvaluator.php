<?php

namespace App\Services\Holdings;

final class HoldingsCoverageEvaluator
{
    public function reasons(array $baseline, string $asOf): array
    {
        $reasons = [];
        if ($baseline['coverage'] !== 'FULL' || ! $baseline['coverage_confirmed']) {
            $reasons[] = 'OPENING_POSITION_COVERAGE_'.$baseline['coverage'];
        }
        // Gate 1 has no authoritative activity-coverage interval attestation.
        if ($asOf > $baseline['as_of_date']) {
            $reasons[] = 'ACTIVITY_COVERAGE_UNKNOWN';
        }

        return $reasons;
    }
}
