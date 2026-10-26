<?php

namespace Tests\Feature;

use App\Models\InvestmentAccount;
use App\Models\Platform;
use App\Models\PortfolioSnapshot;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class HoldingsTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private InvestmentAccount $account;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        $this->owner = User::factory()->create();
        $this->account = $this->account('stockbit');
        $this->actingAs($this->owner);
    }

    private function account(string $code, ?User $owner = null): InvestmentAccount
    {
        $platform = Platform::firstOrCreate(['code' => $code], ['name' => strtoupper($code)]);

        return InvestmentAccount::create(['user_id' => ($owner ?? $this->owner)->id, 'platform_id' => $platform->id, 'account_name' => 'Synthetic account']);
    }

    private function snapshot(array $overrides = [], ?array $items = null, ?InvestmentAccount $account = null): PortfolioSnapshot
    {
        $account ??= $this->account;
        $snapshot = PortfolioSnapshot::create([
            'investment_account_id' => $account->id, 'as_of_date' => '2020-01-31', 'provider' => strtoupper($account->platform->code),
            'document_type' => 'SOA', 'coverage' => 'FULL', 'coverage_confirmed' => true, 'parsed_item_count' => count($items ?? [1]),
            'review_status' => 'CONFIRMED', 'snapshot_hash' => hash('sha256', (string) Str::uuid()), ...$overrides,
        ]);
        foreach ($items ?? [['symbol' => 'TSTA', 'quantity' => '100', 'unit' => 'SHARE']] as $item) {
            $snapshot->items()->create($item);
        }

        return $snapshot;
    }

    private function trade(array $overrides = [], ?InvestmentAccount $account = null): Transaction
    {
        return Transaction::create([
            'investment_account_id' => ($account ?? $this->account)->id, 'transaction_date' => '2020-02-15 00:00:00', 'date_precision' => 'DATE',
            'type' => 'BUY', 'symbol' => 'TSTA', 'unit' => 'SHARE', 'quantity' => '30', 'price' => '10', 'total_amount' => '300', 'currency' => 'IDR',
            'validation_status' => 'PASSED', 'review_status' => 'CONFIRMED', 'imported_at' => '2020-03-05 00:00:00',
            'transaction_hash' => hash('sha256', (string) Str::uuid()), ...$overrides,
        ]);
    }

    private function url(?PortfolioSnapshot $baseline = null, string $asOf = '2020-02-29', ?InvestmentAccount $account = null): string
    {
        return '/api/investment-accounts/'.($account ?? $this->account)->id.'/holdings?as_of='.$asOf.($baseline ? '&baseline_snapshot_id='.$baseline->id : '');
    }

    private function describe(PortfolioSnapshot $snapshot): array
    {
        return $this->getJson('/api/investment-accounts/'.$snapshot->investment_account_id.'/portfolio-snapshots?as_of=2020-12-31')->assertOk()->json('data.0');
    }

    private function confirm(PortfolioSnapshot $snapshot, array $overrides = [])
    {
        $description = $this->describe($snapshot);

        return $this->postJson('/api/investment-accounts/'.$snapshot->investment_account_id.'/portfolio-snapshots/'.$snapshot->id.'/confirm', [
            'confirmed' => true, 'expected_fingerprint' => $description['fingerprint'], 'coverage' => 'FULL',
            'items' => array_map(fn ($item) => ['id' => $item['id'], 'unit' => $item['unit'] === 'UNKNOWN' ? 'SHARE' : $item['unit']], $description['items']), ...$overrides,
        ]);
    }

    public function test_baseline_is_explicit_and_latest_report_is_not_used_as_historical_opening(): void
    {
        $opening = $this->snapshot();
        $closing = $this->snapshot(['as_of_date' => '2020-02-29']);
        $this->getJson($this->url())->assertOk()->assertJsonPath('calculated.status', 'INCOMPLETE')->assertJsonPath('calculated.reasons.0', 'BASELINE_SELECTION_REQUIRED')->assertJsonPath('reported.snapshots.0.id', $closing->id);
        $this->trade();
        $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', '130')->assertJsonPath('calculated.baseline.id', $opening->id)->assertJsonPath('reported.snapshots.0.id', $closing->id);
        $this->getJson($this->url($closing, '2020-02-01'))->assertOk()->assertJsonPath('calculated.reasons.0', 'BASELINE_AFTER_TARGET_DATE');
    }

    public function test_buy_sell_projection_and_cash_dividend_neutrality_with_unknown_activity_coverage(): void
    {
        $opening = $this->snapshot();
        $this->trade();
        $this->trade(['type' => 'SELL', 'quantity' => '10', 'total_amount' => '100']);
        $this->trade(['type' => 'DIVIDEND', 'quantity' => null, 'reference_quantity' => '99999', 'unit' => 'UNKNOWN']);
        $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', '120')->assertJsonPath('calculated.items.0.buy_quantity', '30')->assertJsonPath('calculated.items.0.sell_quantity', '10')->assertJsonPath('calculated.status', 'INCOMPLETE')->assertJsonPath('calculated.reasons.0', 'ACTIVITY_COVERAGE_UNKNOWN')->assertJsonPath('calculated.reconciliation_status', 'NOT_RUN');
        $this->assertDatabaseCount('transactions', 3);
    }

    public function test_account_provider_and_owner_isolation(): void
    {
        $opening = $this->snapshot();
        $otherAccount = $this->account('bions');
        $otherSnapshot = $this->snapshot(account: $otherAccount);
        $this->trade(account: $otherAccount);
        $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', '100');
        $this->getJson($this->url($otherSnapshot, account: $this->account))->assertNotFound();
        $outsider = $this->account('pluang', User::factory()->create());
        $this->getJson($this->url(account: $outsider))->assertNotFound();
        $this->getJson('/api/investment-accounts/'.$outsider->id.'/portfolio-snapshots?as_of=2020-12-31')->assertNotFound();
    }

    public function test_lots_stay_lots_and_are_never_combined_with_shares(): void
    {
        $opening = $this->snapshot(items: [['symbol' => 'TSTA', 'quantity' => '2', 'unit' => 'LOT']]);
        $this->trade(['unit' => 'LOT', 'quantity' => '1']);
        $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', '3')->assertJsonPath('calculated.items.0.unit', 'LOT');
        $this->trade(['unit' => 'SHARE', 'quantity' => '100']);
        $response = $this->getJson($this->url($opening))->assertOk();
        $this->assertCount(2, $response->json('calculated.items'));
        foreach ($response->json('calculated.items') as $row) {
            $this->assertNull($row['quantity']);
            $this->assertContains('INCOMPATIBLE_UNITS_FOR_SYMBOL', $row['reasons']);
        }
    }

    public function test_crypto_uses_exact_eight_decimal_coin_quantities(): void
    {
        $account = $this->account('pluang');
        $opening = $this->snapshot(items: [['symbol' => 'TSTC', 'quantity' => '0.10000001', 'unit' => 'COIN']], account: $account);
        $this->trade(['symbol' => 'TSTC', 'unit' => 'COIN', 'quantity' => '0.00000002'], $account);
        $this->trade(['symbol' => 'TSTC', 'unit' => 'COIN', 'quantity' => '0.00000001', 'type' => 'SELL', 'total_amount' => '1'], $account);
        $this->getJson($this->url($opening, account: $account))->assertOk()->assertJsonPath('calculated.items.0.quantity', '0.10000002')->assertJsonPath('calculated.items.0.unit', 'COIN');
    }

    public function test_date_boundaries_and_late_import_use_effective_date_and_recompute_input_version(): void
    {
        $opening = $this->snapshot();
        $this->trade(['transaction_date' => '2020-01-31']);
        $this->trade(['transaction_date' => '2020-03-01']);
        $before = $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', '100')->json('calculated.input_version');
        $late = $this->trade(['transaction_date' => '2020-02-29', 'quantity' => '0.1', 'imported_at' => '2020-03-05']);
        $response = $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', '100.1');
        $this->assertNotSame($before, $response->json('calculated.input_version'));
        $this->assertSame($response->json('calculated.input_version'), $this->getJson($this->url($opening))->json('calculated.input_version'));
        $late->update(['quantity' => '0.2', 'revision' => 2]);
        $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', '100.2');
        $late->delete();
        $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', '100');
    }

    public function test_timestamp_requires_explicit_timezone_and_cutoff_with_utc_boundaries(): void
    {
        $opening = $this->snapshot();
        $this->trade(['transaction_date' => '2020-01-31 17:00:00', 'date_precision' => 'TIMESTAMP']);
        $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', null);
        $url = $this->url($opening).'&timezone=Asia%2FJakarta&cutoff=23:59:59';
        $this->getJson($url)->assertOk()->assertJsonPath('calculated.items.0.quantity', '130');
        $this->trade(['transaction_date' => '2020-02-29 17:00:00', 'date_precision' => 'TIMESTAMP']);
        $this->getJson($url)->assertOk()->assertJsonPath('calculated.items.0.quantity', '130');
        $this->getJson($this->url($opening).'&timezone=Asia%2FJakarta')->assertUnprocessable();
    }

    public function test_pending_review_invalid_quantity_and_unknown_units_are_not_added(): void
    {
        $opening = $this->snapshot();
        $this->trade(['review_status' => 'REQUIRED']);
        $this->trade(['unit' => 'UNKNOWN', 'quantity' => '1']);
        $this->trade(['quantity' => null, 'transaction_date' => '2020-02-16']);
        $response = $this->getJson($this->url($opening))->assertOk();
        foreach ($response->json('calculated.items') as $row) {
            $this->assertNull($row['quantity']);
            $this->assertSame('0', $row['buy_quantity']);
        }
        $this->assertCount(3, $response->json('calculated.excluded_events'));
    }

    public function test_duplicate_canonical_identities_are_excluded_even_with_legacy_different_hashes(): void
    {
        $opening = $this->snapshot();
        $this->trade();
        $this->trade();
        $response = $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', null)->assertJsonPath('calculated.items.0.buy_quantity', '0');
        $this->assertContains('UNRESOLVED_DUPLICATE_CANDIDATE', $response->json('calculated.items.0.reasons'));
    }

    public function test_pending_unlinked_observation_blocks_existing_candidate_without_double_counting(): void
    {
        $opening = $this->snapshot();
        $trade = $this->trade();
        $response = $this->postJson('/api/source-imports', [
            'schema_version' => 'integrity-v1', 'investment_account_id' => $this->account->id,
            'confirmed' => true, 'idempotency_key' => 'synthetic-pending',
            'source' => ['provider' => 'STOCKBIT', 'source_type' => 'PDF', 'document_type' => 'TC', 'document_hash' => hash('sha256', 'synthetic-pending'), 'parser_version' => 'synthetic@1'],
            'transactions' => [['row_key' => 'one', 'transaction_date' => '2020-02-15', 'date_precision' => 'DATE', 'type' => 'BUY', 'symbol' => 'TSTA', 'unit' => 'SHARE', 'quantity' => '30', 'price' => '10', 'total_amount' => '300', 'currency' => 'IDR']],
        ])->assertOk()->assertJsonPath('results.0.status', 'PENDING_REVIEW');
        $this->assertContains($trade->id, $response->json('results.0.candidate_ids'));
        $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', null)->assertJsonPath('calculated.items.0.buy_quantity', '0');
        $this->assertDatabaseCount('transactions', 1);
    }

    public function test_partial_and_unknown_baselines_do_not_make_absent_assets_zero(): void
    {
        foreach (['PARTIAL', 'UNKNOWN'] as $coverage) {
            $opening = $this->snapshot(['coverage' => $coverage, 'as_of_date' => $coverage === 'PARTIAL' ? '2020-01-30' : '2020-01-31']);
            $this->trade(['symbol' => 'TSTB', 'transaction_date' => $coverage === 'PARTIAL' ? '2020-02-01' : '2020-02-02']);
            $response = $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.status', 'INCOMPLETE');
            $missing = collect($response->json('calculated.items'))->firstWhere('symbol', 'TSTB');
            $this->assertNull($missing['opening_quantity']);
            $this->assertNull($missing['quantity']);
            $this->assertSame('100', $response->json('calculated.items.0.quantity'));
        }
    }

    public function test_monthly_only_reports_latest_snapshot_without_creating_trades_or_claiming_activity_complete(): void
    {
        $opening = $this->snapshot();
        $latest = $this->snapshot(['as_of_date' => '2020-02-29'], [['symbol' => 'TSTA', 'quantity' => '250', 'unit' => 'SHARE']]);
        $this->getJson($this->url($opening))->assertOk()->assertJsonPath('reported.snapshots.0.id', $latest->id)->assertJsonPath('reported.snapshots.0.items.0.quantity', '250')->assertJsonPath('calculated.items.0.quantity', '100')->assertJsonPath('calculated.status', 'INCOMPLETE');
        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_same_date_conflict_is_visible_and_not_selected_or_confirmed_automatically(): void
    {
        $one = $this->snapshot();
        $this->snapshot(items: [['symbol' => 'TSTA', 'quantity' => '200', 'unit' => 'SHARE']]);
        $response = $this->getJson($this->url($one))->assertOk()->assertJsonPath('reported.status', 'PENDING_REVIEW');
        $this->assertCount(2, $response->json('reported.snapshots'));
        $this->assertContains('SAME_DATE_SNAPSHOT_CONFLICT', $response->json('calculated.reasons'));
        $description = $response->json('reported.snapshots.0');
        $this->postJson('/api/investment-accounts/'.$this->account->id.'/portfolio-snapshots/'.$one->id.'/confirm', ['confirmed' => true, 'expected_fingerprint' => $description['fingerprint'], 'coverage' => 'FULL', 'items' => [['id' => $one->items->first()->id, 'unit' => 'SHARE']]])->assertConflict();
    }

    public function test_empty_and_missing_holdings_are_different_and_no_get_writes_occur(): void
    {
        $this->getJson($this->url())->assertOk()->assertJsonPath('reported.status', 'NOT_AVAILABLE')->assertJsonPath('calculated.status', 'INCOMPLETE');
        $empty = $this->snapshot(items: []);
        $this->getJson($this->url($empty, '2020-01-31'))->assertOk()->assertJsonPath('calculated.status', 'COMPLETE')->assertJsonPath('calculated.items', [])->assertJsonPath('reported.snapshots.0.items', []);
        $this->assertDatabaseCount('integrity_audit_events', 0);
        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_snapshot_confirmation_records_audit_without_changing_quantities_or_original_evidence(): void
    {
        $opening = $this->snapshot(['review_status' => 'REQUIRED', 'coverage' => 'UNKNOWN', 'coverage_confirmed' => false], [['symbol' => 'TSTA', 'quantity' => '100', 'unit' => 'UNKNOWN']]);
        $quantity = $opening->items->first()->quantity;
        $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.status', 'INCOMPLETE');
        $this->confirm($opening)->assertOk()->assertJsonPath('data.review_status', 'CONFIRMED')->assertJsonPath('data.items.0.unit', 'SHARE');
        $this->assertSame($quantity, $opening->fresh()->items->first()->quantity);
        $this->assertDatabaseHas('integrity_audit_events', ['action' => 'SNAPSHOT_CONFIRMED', 'actor_id' => $this->owner->id]);
        $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', '100');
    }

    public function test_confirmation_rejects_stale_fingerprint_quantity_replacement_incomplete_items_and_unit_conversion(): void
    {
        $opening = $this->snapshot(['review_status' => 'REQUIRED']);
        $this->confirm($opening, ['expected_fingerprint' => str_repeat('a', 64)])->assertConflict();
        $this->confirm($opening, ['items' => []])->assertUnprocessable();
        $itemId = $opening->items->first()->id;
        $this->confirm($opening, ['items' => [['id' => $itemId, 'unit' => 'SHARE'], ['id' => (string) $itemId, 'unit' => 'SHARE']]])->assertUnprocessable();
        $this->confirm($opening, ['items' => [['id' => $opening->items->first()->id, 'unit' => 'LOT']]])->assertUnprocessable();
        $this->confirm($opening, ['items' => [['id' => $opening->items->first()->id, 'unit' => 'SHARE', 'quantity' => '900']]])->assertUnprocessable();
        $this->assertDatabaseCount('integrity_audit_events', 0);
        $this->assertSame('REQUIRED', $opening->fresh()->review_status);
    }

    public function test_known_full_baseline_can_open_a_new_asset_at_zero_and_negative_final_position_is_reviewable(): void
    {
        $opening = $this->snapshot();
        $this->trade(['symbol' => 'TSTB']);
        $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.1.opening_quantity', '0')->assertJsonPath('calculated.items.1.quantity', '30');
        $this->trade(['quantity' => '200', 'type' => 'SELL']);
        $response = $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', null);
        $this->assertContains('NEGATIVE_POSITION_REQUIRES_REVIEW', $response->json('calculated.items.0.reasons'));
    }

    public function test_unsupported_quantity_corporate_action_is_not_a_synthetic_buy_or_sell(): void
    {
        $opening = $this->snapshot();
        $this->trade(['type' => 'SPLIT']);
        $response = $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', null);
        $this->assertContains('UNSUPPORTED_QUANTITY_EVENT', $response->json('calculated.items.0.reasons'));
        $this->assertDatabaseCount('transactions', 1);
    }

    public function test_read_endpoints_require_authentication(): void
    {
        auth()->forgetGuards();
        $this->getJson($this->url())->assertUnauthorized();
    }

    public function test_imported_statement_confirmation_preserves_original_source_observation_and_quantities(): void
    {
        $response = $this->postJson('/api/source-imports', [
            'schema_version' => 'integrity-v1', 'investment_account_id' => $this->account->id,
            'confirmed' => true, 'idempotency_key' => 'synthetic-statement',
            'source' => ['provider' => 'STOCKBIT', 'source_type' => 'PDF', 'document_type' => 'SOA', 'document_hash' => hash('sha256', 'synthetic-statement'), 'parser_version' => 'synthetic@1'],
            'transactions' => [], 'snapshot' => ['as_of_date' => '2020-01-31', 'coverage' => 'UNKNOWN', 'parsed_item_count' => 1,
                'items' => [['symbol' => 'TSTA', 'quantity' => '100', 'unit' => 'UNKNOWN', 'currency' => 'IDR']]],
        ])->assertOk();
        $snapshot = PortfolioSnapshot::findOrFail($response->json('results.0.snapshot_id'));
        $original = DB::table('source_observations')->sole()->structured_data;
        $this->confirm($snapshot)->assertOk()->assertJsonPath('data.authoritative_reported', true);
        $this->assertSame($original, DB::table('source_observations')->sole()->structured_data);
        $this->assertDatabaseHas('source_observations', ['review_status' => 'CONFIRMED']);
        $read = $this->getJson($this->url($snapshot))->assertOk()->assertJsonPath('calculated.items.0.quantity', '100');
        $this->assertSame($response->json('source_document_id'), $read->json('reported.snapshots.0.source.id'));
        $this->assertStringNotContainsString('document_hash', $read->getContent());
        $this->assertStringNotContainsString('structured_data', $read->getContent());
        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_full_attestation_requires_known_parsed_count_and_cannot_confirm_another_accounts_snapshot(): void
    {
        $snapshot = $this->snapshot(['review_status' => 'REQUIRED', 'coverage' => 'UNKNOWN', 'parsed_item_count' => null]);
        $this->confirm($snapshot)->assertUnprocessable();
        $this->confirm($snapshot, ['coverage' => 'PARTIAL'])->assertOk()->assertJsonPath('data.coverage', 'PARTIAL');
        $other = $this->account('bions');
        $this->postJson('/api/investment-accounts/'.$other->id.'/portfolio-snapshots/'.$snapshot->id.'/confirm', [
            'confirmed' => true, 'expected_fingerprint' => str_repeat('a', 64), 'coverage' => 'FULL', 'items' => [],
        ])->assertNotFound();
        $this->actingAs(User::factory()->create());
        $this->postJson('/api/investment-accounts/'.$this->account->id.'/portfolio-snapshots/'.$snapshot->id.'/confirm', [])->assertNotFound();
    }

    public function test_rejected_transaction_and_unvalidated_transaction_cannot_add_quantity(): void
    {
        $opening = $this->snapshot();
        $this->trade(['validation_status' => 'REJECTED']);
        $this->trade(['validation_status' => 'LEGACY_UNVERIFIED', 'transaction_date' => '2020-02-16']);
        $response = $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', null)->assertJsonPath('calculated.items.0.buy_quantity', '0');
        $this->assertCount(2, $response->json('calculated.excluded_events'));
    }

    public function test_distinct_explicit_trade_references_are_not_false_duplicates(): void
    {
        $opening = $this->snapshot();
        $this->trade(['external_identifier' => 'synthetic-ref-1']);
        $this->trade(['external_identifier' => 'synthetic-ref-2']);
        $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', '160');
    }

    public function test_confirmation_never_maps_crypto_to_stock_units_and_preserves_unknown_coverage(): void
    {
        $account = $this->account('pluang');
        $snapshot = $this->snapshot(['review_status' => 'REQUIRED', 'coverage' => 'UNKNOWN', 'coverage_confirmed' => false], [['symbol' => 'TSTC', 'quantity' => '0.1', 'unit' => 'UNKNOWN']], $account);
        $this->confirm($snapshot)->assertUnprocessable();
        $this->confirm($snapshot, ['coverage' => 'UNKNOWN', 'items' => [['id' => $snapshot->items->first()->id, 'unit' => 'COIN']]])->assertOk()->assertJsonPath('data.coverage_confirmed', false);
        $this->getJson($this->url($snapshot, account: $account))->assertOk()->assertJsonPath('calculated.items.0.quantity', '0.1')->assertJsonPath('calculated.status', 'INCOMPLETE');
    }

    public function test_legacy_invalid_quantity_is_unavailable_instead_of_crashing_or_becoming_zero(): void
    {
        $opening = $this->snapshot();
        $this->trade(['quantity' => null]);
        $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', null);
        DB::table('transactions')->update(['quantity' => 'invalid-legacy']);
        $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', null);
    }

    public function test_new_same_date_statement_invalidates_a_previously_usable_baseline(): void
    {
        $opening = $this->snapshot();
        $old = $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', '100')->json('calculated.input_version');
        $this->snapshot(['review_status' => 'REQUIRED']);
        $response = $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items', []);
        $this->assertContains('SAME_DATE_SNAPSHOT_CONFLICT', $response->json('calculated.reasons'));
        $this->assertNotSame($old, $response->json('calculated.input_version'));
    }

    public function test_invalid_cross_account_source_link_never_exposes_another_users_evidence(): void
    {
        $other = $this->account('stockbit', User::factory()->create());
        $publicId = (string) Str::uuid();
        $sourceId = DB::table('source_documents')->insertGetId([
            'public_id' => $publicId, 'investment_account_id' => $other->id, 'provider' => 'STOCKBIT',
            'source_type' => 'PDF', 'document_type' => 'SOA', 'document_hash' => hash('sha256', 'synthetic-other-user'),
            'parser_version' => 'synthetic-other-user@1', 'imported_at' => now(),
        ]);
        $opening = $this->snapshot(['source_document_id' => $sourceId]);
        $response = $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items', [])->assertJsonPath('reported.snapshots.0.source', null);
        $this->assertContains('INVALID_SOURCE_LINK', $response->json('calculated.reasons'));
        $this->assertStringNotContainsString($publicId, $response->getContent());
        $this->assertStringNotContainsString('synthetic-other-user@1', $response->getContent());
    }

    public function test_cash_only_events_are_neutral_but_asset_transfers_with_missing_quantity_require_review(): void
    {
        $opening = $this->snapshot();
        $this->trade(['type' => 'DEPOSIT', 'symbol' => null, 'unit' => 'UNKNOWN', 'quantity' => null]);
        $this->trade(['type' => 'FEE', 'symbol' => null, 'unit' => 'UNKNOWN', 'quantity' => null]);
        $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', '100');
        $this->trade(['type' => 'WITHDRAWAL', 'quantity' => null]);
        $response = $this->getJson($this->url($opening))->assertOk()->assertJsonPath('calculated.items.0.quantity', null);
        $this->assertContains('UNSUPPORTED_QUANTITY_EVENT', $response->json('calculated.items.0.reasons'));
    }
}
