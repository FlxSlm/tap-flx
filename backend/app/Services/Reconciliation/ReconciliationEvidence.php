<?php

namespace App\Services\Reconciliation;

use App\Models\InvestmentAccount;
use App\Models\Transaction;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class ReconciliationEvidence
{
    public function collect(InvestmentAccount $account, array $projection, array $closing): array
    {
        $transactionIds = collect($projection['items'])->flatMap(fn ($item) => $item['transaction_ids'])->unique()->sort()->values()->all();
        $transactions = Transaction::where('investment_account_id', $account->id)->whereIn('id', $transactionIds)->orderBy('id')->get();
        $links = DB::table('source_observations as observations')
            ->join('source_documents as sources', 'sources.id', '=', 'observations.source_document_id')
            ->join('import_batches as batches', 'batches.id', '=', 'observations.import_batch_id')
            ->where('sources.investment_account_id', $account->id)->where('batches.investment_account_id', $account->id)
            ->whereColumn('batches.source_document_id', 'sources.id')->whereIn('observations.transaction_id', $transactionIds)
            ->orderBy('observations.id')->get([
                'observations.id as observation_id', 'observations.transaction_id', 'observations.review_status', 'observations.validation_status', 'observations.status',
                'sources.public_id as source_id', 'sources.provider', 'sources.document_type', 'sources.parser_version', 'sources.imported_at', 'batches.public_id as batch_id',
            ]);
        $sources = [];
        $issues = [];
        $snapshots = [];
        foreach (['opening' => $projection['baseline'], 'closing' => $closing] as $role => $snapshot) {
            $snapshots[$role] = $snapshot === null ? null : array_intersect_key($snapshot, array_flip(['id', 'as_of_date', 'provider', 'coverage', 'coverage_confirmed', 'activity_coverage', 'review_status', 'source', 'source_indicator', 'fingerprint', 'baseline_issues']));
            if ($snapshot === null || $snapshot['source'] === null) {
                $issues[] = strtoupper($role).'_SOURCE_EVIDENCE_MISSING';
            } else {
                $sources[$snapshot['source']['id']] = $snapshot['source'];
            }
        }
        $records = [];
        foreach ($transactions as $transaction) {
            $references = [];
            foreach ($links->where('transaction_id', $transaction->id) as $link) {
                if ($link->provider !== strtoupper($account->platform->code) || $link->review_status !== 'CONFIRMED' || $link->validation_status !== 'PASSED'
                    || ! in_array($link->status, ['CREATED', 'LINKED_EXISTING', 'REPLAYED'], true)) {
                    $issues[] = 'TRANSACTION_SOURCE_REQUIRES_REVIEW';

                    continue;
                }
                $sources[$link->source_id] = ['id' => $link->source_id, 'provider' => $link->provider, 'document_type' => $link->document_type, 'parser_version' => $link->parser_version, 'imported_at' => $link->imported_at];
                $references[] = ['source_id' => $link->source_id, 'observation_id' => $link->observation_id, 'batch_id' => $link->batch_id];
            }
            if ($references === []) {
                $issues[] = 'TRANSACTION_SOURCE_EVIDENCE_MISSING';
            }
            $records[] = [
                'id' => $transaction->id, 'revision' => $transaction->revision, 'symbol' => $transaction->symbol, 'unit' => $transaction->unit,
                'effective_date' => $transaction->date_precision === 'DATE' ? substr($transaction->getRawOriginal('transaction_date'), 0, 10) : CarbonImmutable::parse($transaction->getRawOriginal('transaction_date'), 'UTC')->toIso8601String(), 'date_precision' => $transaction->date_precision, 'type' => $transaction->type,
                'source_references' => $references,
            ];
        }
        ksort($sources);

        return ['snapshots' => $snapshots, 'transactions' => $records, 'sources' => array_values($sources), 'issues' => array_values(array_unique($issues)), 'excluded_events' => $projection['excluded_events']];
    }
}
