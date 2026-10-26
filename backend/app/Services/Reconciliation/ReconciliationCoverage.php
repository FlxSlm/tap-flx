<?php

namespace App\Services\Reconciliation;

use Illuminate\Validation\ValidationException;

final class ReconciliationCoverage
{
    public function evaluate(?array $confirmation, string $inputVersion, array $evidence, int $actor): array
    {
        $result = ['status' => 'UNKNOWN', 'dimension' => 'ASSET_QUANTITY_ACTIVITY', 'basis' => 'NO_PERIOD_ATTESTATION', 'confirmed' => false, 'input_version' => $inputVersion, 'source_ids' => [], 'actor_id' => null, 'reasons' => ['ACTIVITY_COVERAGE_UNKNOWN']];
        if ($confirmation === null) {
            return $result;
        }
        if (! hash_equals($inputVersion, $confirmation['input_version'])) {
            return [...$result, 'reasons' => ['ACTIVITY_COVERAGE_UNKNOWN', 'COVERAGE_CONFIRMATION_STALE']];
        }
        $provided = array_values(array_unique($confirmation['source_ids']));
        sort($provided);
        $required = array_column($evidence['sources'], 'id');
        sort($required);
        if (array_diff($provided, $required) !== []) {
            throw ValidationException::withMessages(['coverage.source_ids' => 'Only source references belonging to this account and current comparison may be confirmed.']);
        }
        if ($required === [] || $provided !== $required) {
            throw ValidationException::withMessages(['coverage.source_ids' => 'Confirm all relevant source references after reviewing the complete interval.']);
        }

        return ['status' => 'FULL', 'dimension' => 'ASSET_QUANTITY_ACTIVITY', 'basis' => 'USER_ATTESTED_PERIOD', 'confirmed' => true, 'input_version' => $inputVersion, 'source_ids' => $provided, 'actor_id' => $actor, 'reasons' => []];
    }
}
