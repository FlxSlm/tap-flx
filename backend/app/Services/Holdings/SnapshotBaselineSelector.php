<?php

namespace App\Services\Holdings;

use App\Models\InvestmentAccount;
use App\Models\PortfolioSnapshot;
use App\Services\Integrity\SourceImporter;
use Illuminate\Support\Facades\DB;

final class SnapshotBaselineSelector
{
    public function describe(PortfolioSnapshot $snapshot, InvestmentAccount $account): array
    {
        $snapshot->loadMissing('items');
        $source = $snapshot->source_document_id ? DB::table('source_documents')->find($snapshot->source_document_id) : null;
        $issues = [];
        if ($snapshot->investment_account_id !== $account->id || strtoupper($account->platform->code) !== $snapshot->provider || $snapshot->document_type !== 'SOA') {
            $issues[] = 'INVALID_ACCOUNT_PROVIDER_OR_DOCUMENT';
        }
        if ($snapshot->source_document_id && (! $source || $source->investment_account_id !== $account->id || $source->provider !== $snapshot->provider || $source->document_type !== 'SOA')) {
            $issues[] = 'INVALID_SOURCE_LINK';
        }
        $safeSource = $source && (int) $source->investment_account_id === $account->id && $source->provider === $snapshot->provider && $source->document_type === 'SOA' ? $source : null;
        if ($snapshot->review_status !== 'CONFIRMED') {
            $issues[] = 'SNAPSHOT_NOT_CONFIRMED';
        }
        if (PortfolioSnapshot::where('investment_account_id', $account->id)->whereDate('as_of_date', $snapshot->as_of_date)->where('id', '!=', $snapshot->id)->exists()) {
            $issues[] = 'SAME_DATE_SNAPSHOT_CONFLICT';
        }
        $symbols = [];
        $items = [];
        foreach ($snapshot->items->sortBy('id') as $item) {
            $symbol = strtoupper($item->symbol);
            if (! preg_match('/^[A-Z0-9._-]{1,30}$/D', $symbol) || isset($symbols[$symbol])) {
                $issues[] = 'INVALID_OR_DUPLICATE_SNAPSHOT_SYMBOL';
            }
            $symbols[$symbol] = true;
            try {
                $quantity = QuantityDecimal::normalize($item->quantity);
            } catch (\Throwable) {
                $quantity = null;
                $issues[] = 'INVALID_SNAPSHOT_QUANTITY';
            }
            if (! self::validUnit($account, $item->unit)) {
                $issues[] = 'UNKNOWN_OR_INVALID_SNAPSHOT_UNIT';
            }
            $items[] = ['id' => $item->id, 'symbol' => $symbol, 'quantity' => $quantity, 'unit' => $item->unit ?? 'UNKNOWN'];
        }
        if ($snapshot->coverage === 'FULL' && (! $snapshot->coverage_confirmed || $snapshot->parsed_item_count !== count($items))) {
            $issues[] = 'INVALID_FULL_POSITION_COVERAGE';
        }
        $observations = DB::table('source_observations')->where('portfolio_snapshot_id', $snapshot->id)->orderBy('id')->get(['id', 'status', 'review_status', 'validation_status']);
        if ($observations->contains(fn ($row) => $row->validation_status !== 'PASSED' || $row->review_status !== 'CONFIRMED' || ! in_array($row->status, ['CREATED', 'REPLAYED', 'LINKED_EXISTING'], true))) {
            $issues[] = 'SNAPSHOT_SOURCE_REQUIRES_REVIEW';
        }
        $data = [
            'id' => $snapshot->id, 'as_of_date' => $snapshot->as_of_date->format('Y-m-d'),
            'provider' => $snapshot->provider, 'coverage' => $snapshot->coverage,
            'coverage_confirmed' => $snapshot->coverage_confirmed, 'activity_coverage' => $snapshot->activity_coverage,
            'review_status' => $snapshot->review_status, 'parsed_item_count' => $snapshot->parsed_item_count,
            'source' => $safeSource ? ['id' => $safeSource->public_id, 'provider' => $safeSource->provider, 'document_type' => $safeSource->document_type, 'parser_version' => $safeSource->parser_version, 'imported_at' => $safeSource->imported_at] : null,
            'source_indicator' => $snapshot->source_document_id ? ($safeSource ? 'SOURCE_DOCUMENT' : 'UNVERIFIED_SOURCE_LINK') : 'LEGACY_OR_MANUAL',
            'items' => $items, 'baseline_issues' => array_values(array_unique($issues)),
        ];
        $data['authoritative_reported'] = $data['baseline_issues'] === [];
        $data['fingerprint'] = SourceImporter::digest([$data, $observations->toArray()]);

        return $data;
    }

    public static function validUnit(InvestmentAccount $account, ?string $unit): bool
    {
        $provider = strtolower($account->platform->code);

        return in_array($provider, ['stockbit', 'bions', 'pluang'], true)
            && in_array($unit, $provider === 'pluang' ? ['COIN'] : ['SHARE', 'LOT'], true);
    }

    public function select(InvestmentAccount $account, ?int $id, string $asOf): array
    {
        if ($id === null) {
            return ['snapshot' => null, 'reasons' => ['BASELINE_SELECTION_REQUIRED']];
        }
        $snapshot = PortfolioSnapshot::where('investment_account_id', $account->id)->findOrFail($id);
        $data = $this->describe($snapshot, $account);
        $reasons = $data['baseline_issues'];
        if ($data['as_of_date'] > $asOf) {
            $reasons[] = 'BASELINE_AFTER_TARGET_DATE';
        }

        return ['snapshot' => $data, 'reasons' => $reasons];
    }

    public function reported(InvestmentAccount $account, string $asOf): array
    {
        $day = PortfolioSnapshot::where('investment_account_id', $account->id)->whereDate('as_of_date', '<=', $asOf)->max('as_of_date');
        $day = $day ? substr((string) $day, 0, 10) : null;
        $snapshots = $day ? PortfolioSnapshot::with('items')->where('investment_account_id', $account->id)->whereDate('as_of_date', $day)->orderBy('id')->get() : collect();

        return [
            'status' => $snapshots->isEmpty() ? 'NOT_AVAILABLE' : ($snapshots->count() > 1 || $snapshots->first()->review_status !== 'CONFIRMED' ? 'PENDING_REVIEW' : 'REPORTED'),
            'as_of_date' => $day, 'snapshots' => $snapshots->map(fn ($snapshot) => $this->describe($snapshot, $account))->all(),
        ];
    }
}
