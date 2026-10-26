<?php

namespace App\Services\Reconciliation;

use App\Models\InvestmentAccount;
use App\Models\PortfolioSnapshot;
use App\Services\Holdings\HoldingsProjectionService;
use App\Services\Holdings\SnapshotBaselineSelector;
use App\Services\Integrity\SourceImporter;
use Illuminate\Validation\ValidationException;

final class ReconciliationService
{
    public const RULE_VERSION = 'reconciliation-v1';

    private const REVIEW_REASONS = [
        'SAME_DATE_SNAPSHOT_CONFLICT', 'SNAPSHOT_NOT_CONFIRMED', 'SNAPSHOT_SOURCE_REQUIRES_REVIEW',
        'INVALID_SOURCE_LINK', 'INVALID_ACCOUNT_PROVIDER_OR_DOCUMENT', 'UNRESOLVED_SOURCE_OBSERVATION',
        'UNRESOLVED_DUPLICATE_CANDIDATE', 'TRANSACTION_REQUIRES_REVIEW', 'NEGATIVE_POSITION_REQUIRES_REVIEW',
        'TRANSACTION_SOURCE_REQUIRES_REVIEW',
    ];

    public function __construct(
        private HoldingsProjectionService $holdings,
        private SnapshotBaselineSelector $selector,
        private QuantityComparison $comparison,
        private ReconciliationEvidence $evidence,
        private ReconciliationCoverage $coverage,
    ) {}

    public function evaluate(InvestmentAccount $account, int $actor, array $input): array
    {
        $opening = PortfolioSnapshot::where('investment_account_id', $account->id)->findOrFail($input['opening_snapshot_id']);
        $closing = PortfolioSnapshot::where('investment_account_id', $account->id)->findOrFail($input['closing_snapshot_id']);
        if ($closing->as_of_date->lessThanOrEqualTo($opening->as_of_date)) {
            throw ValidationException::withMessages(['closing_snapshot_id' => 'Closing snapshot must be later than opening; self-comparison is not reconciliation.']);
        }
        $closingData = $this->selector->describe($closing, $account);
        $projection = $this->holdings->project($account, $closingData['as_of_date'], $opening->id, $input['timezone'] ?? null, $input['cutoff'] ?? null)->jsonSerialize();
        $evidence = $this->evidence->collect($account, $projection, $closingData);
        $inputVersion = SourceImporter::digest([self::RULE_VERSION, $account->id, $projection['input_version'], $closingData['fingerprint'], $evidence]);
        $coverage = $this->coverage->evaluate($input['coverage'] ?? null, $inputVersion, $evidence, $actor);
        $snapshotReasons = [...$projection['baseline']['baseline_issues'], ...$closingData['baseline_issues']];
        foreach (['OPENING' => $projection['baseline'], 'CLOSING' => $closingData] as $role => $snapshot) {
            if ($snapshot['coverage'] !== 'FULL' || ! $snapshot['coverage_confirmed']) {
                $snapshotReasons[] = $role.'_POSITION_COVERAGE_'.$snapshot['coverage'];
            }
        }
        $sharedReasons = array_values(array_unique([...$snapshotReasons, ...$evidence['issues'], ...$coverage['reasons']]));
        $rows = $this->comparison->compare($projection, $closingData, strtolower($account->platform->code) === 'pluang' ? ['COIN'] : ['SHARE', 'LOT']);
        $items = [];
        $counts = array_fill_keys(['MATCHED', 'MISMATCH', 'INCOMPLETE', 'PENDING_REVIEW'], 0);
        foreach ($rows as $row) {
            $projectionReasons = $coverage['confirmed'] ? array_values(array_diff($row['projection_reasons'], ['ACTIVITY_COVERAGE_UNKNOWN'])) : $row['projection_reasons'];
            $reasons = array_values(array_unique([...$sharedReasons, ...$projectionReasons, ...$row['comparison_reasons']]));
            if ($row['difference'] !== null && $row['difference'] !== '0') {
                $diagnostics = ['QUANTITY_DIFFERENCE_OBSERVED', 'POSSIBLE_MISSING_OR_UNSUPPORTED_ACTIVITY'];
            } elseif ($row['difference'] === '0' && ! $coverage['confirmed']) {
                $diagnostics = ['NUMERICALLY_EQUAL_BUT_COVERAGE_UNVERIFIED'];
            } else {
                $diagnostics = [];
            }
            $review = array_intersect($reasons, self::REVIEW_REASONS) !== [];
            $status = $review ? 'PENDING_REVIEW' : ($reasons !== [] || $row['difference'] === null ? 'INCOMPLETE' : ($row['difference'] === '0' ? 'MATCHED' : 'MISMATCH'));
            if ($status === 'INCOMPLETE' && $row['difference'] === '0' && ! in_array('NUMERICALLY_EQUAL_BUT_COVERAGE_UNVERIFIED', $diagnostics, true)) {
                $diagnostics[] = 'NUMERICALLY_EQUAL_BUT_COVERAGE_UNVERIFIED';
            }
            if ($status === 'MISMATCH') {
                $diagnostics[] = 'QUANTITY_MISMATCH';
            }
            if ($status === 'INCOMPLETE' && $row['difference'] !== null && $row['difference'] !== '0') {
                $diagnostics[] = 'PROVISIONAL_QUANTITY_DIFFERENCE';
            }
            $transactionEvidence = array_values(array_filter($evidence['transactions'], fn ($transaction) => in_array($transaction['id'], $row['transaction_ids'], true)));
            $items[] = [...$row, 'status' => $status, 'reasons' => $reasons, 'diagnostics' => $diagnostics,
                'coverage_status' => $coverage['status'], 'transaction_evidence' => $transactionEvidence,
                'possible_causes' => $row['difference'] !== null && $row['difference'] !== '0' ? ['IMPORT_GAP', 'UNIT_MAPPING', 'ASSET_TRANSFER', 'CORPORATE_ACTION', 'PARSER_ERROR', 'COVERAGE_GAP'] : [],
            ];
            $counts[$status]++;
        }
        $reasons = array_values(array_unique([...$sharedReasons, ...array_merge([], ...array_column($items, 'reasons'))]));
        if ($items === []) {
            $remainingProjectionReasons = $coverage['confirmed'] ? array_diff($projection['reasons'], ['ACTIVITY_COVERAGE_UNKNOWN']) : $projection['reasons'];
            $reasons = array_values(array_unique([...$reasons, ...$remainingProjectionReasons]));
        }
        $status = match (true) {
            $counts['PENDING_REVIEW'] > 0 || array_intersect($reasons, self::REVIEW_REASONS) !== [] => 'PENDING_REVIEW',
            $counts['INCOMPLETE'] > 0 || $reasons !== [] => 'INCOMPLETE',
            $counts['MISMATCH'] > 0 => 'MISMATCH',
            default => 'MATCHED',
        };

        return [
            'account' => ['id' => $account->id, 'account_name' => $account->account_name, 'provider' => strtoupper($account->platform->code)],
            'parameters' => ['opening_snapshot_id' => $opening->id, 'closing_snapshot_id' => $closing->id, 'timezone' => $input['timezone'] ?? null, 'cutoff' => $input['cutoff'] ?? null],
            'window' => $projection['window'], 'status' => $status, 'counts' => $counts, 'reasons' => $reasons,
            'coverage' => $coverage, 'items' => $items, 'evidence' => $evidence,
            'input_version' => $inputVersion, 'projection_input_version' => $projection['input_version'],
            'rule_version' => self::RULE_VERSION, 'calculated_at' => now()->utc()->toIso8601String(),
            'previous_input_stale' => isset($input['previous_input_version']) && ! hash_equals($inputVersion, $input['previous_input_version']),
            'quantity_tolerance' => '0', 'verification_basis' => $coverage['confirmed'] ? 'VALIDATED_INPUTS_AND_USER_ATTESTATION' : 'UNVERIFIED_ACTIVITY_COVERAGE',
            'projection_status' => $projection['status'],
        ];
    }
}
