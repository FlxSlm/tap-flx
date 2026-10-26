<?php

namespace Tests\Feature;

use App\Models\InvestmentAccount;
use App\Models\Platform;
use App\Models\PortfolioSnapshot;
use App\Models\Transaction;
use App\Models\User;
use App\Services\Holdings\SnapshotBaselineSelector;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ReconciliationTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private InvestmentAccount $account;

    private int $sourceSequence = 0;

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

        return InvestmentAccount::create(['user_id' => ($owner ?? $this->owner)->id, 'platform_id' => $platform->id, 'account_name' => 'Synthetic reconciliation account']);
    }

    private function envelope(string $type, InvestmentAccount $account): array
    {
        $key = 'synthetic-reconciliation-'.(++$this->sourceSequence);

        return [
            'schema_version' => 'integrity-v1', 'investment_account_id' => $account->id, 'confirmed' => true, 'idempotency_key' => $key,
            'source' => ['provider' => strtoupper($account->platform->code), 'source_type' => 'PDF', 'document_type' => $type, 'document_hash' => hash('sha256', $key), 'parser_version' => 'synthetic@1'],
            'transactions' => [],
        ];
    }

    private function statement(string $day, ?string $quantity = '100', string $coverage = 'FULL', string $unit = 'SHARE', ?InvestmentAccount $account = null, bool $confirm = true): PortfolioSnapshot
    {
        $account ??= $this->account;
        $items = $quantity === null ? [] : [['symbol' => 'TSTA', 'unit' => $unit, 'quantity' => $quantity, 'currency' => 'IDR']];
        $response = $this->postJson('/api/source-imports', [...$this->envelope('SOA', $account), 'snapshot' => [
            'as_of_date' => $day, 'coverage' => $coverage, 'coverage_confirmed' => $coverage === 'FULL', 'parsed_item_count' => count($items), 'items' => $items,
        ]])->assertOk();
        $snapshot = PortfolioSnapshot::findOrFail($response->json('results.0.snapshot_id'));
        if ($confirm) {
            $descriptor = app(SnapshotBaselineSelector::class)->describe($snapshot, $account);
            $this->postJson('/api/investment-accounts/'.$account->id.'/portfolio-snapshots/'.$snapshot->id.'/confirm', [
                'confirmed' => true, 'expected_fingerprint' => $descriptor['fingerprint'], 'coverage' => $coverage,
                'items' => array_map(fn ($item) => ['id' => $item['id'], 'unit' => $item['unit']], $descriptor['items']),
            ])->assertOk();
        }

        return $snapshot->fresh();
    }

    private function trade(string $day = '2020-02-10', string $quantity = '30', string $type = 'BUY', ?InvestmentAccount $account = null, array $extra = [])
    {
        $account ??= $this->account;
        $envelope = $this->envelope($type === 'DIVIDEND' ? 'CA' : 'TC', $account);

        return $this->postJson('/api/source-imports', [...$envelope, 'transactions' => [[
            'row_key' => 'synthetic-row', 'transaction_date' => $day, 'date_precision' => 'DATE',
            'type' => $type, 'symbol' => 'TSTA', 'unit' => 'SHARE', 'quantity' => $type === 'DIVIDEND' ? null : $quantity,
            'price' => $type === 'DIVIDEND' ? null : '1', 'total_amount' => '1', 'currency' => 'IDR', ...$extra,
        ]]])->assertOk();
    }

    private function fixture(string $closingQuantity = '120'): array
    {
        $opening = $this->statement('2020-01-31');
        $this->trade();
        $this->trade('2020-02-15', '10', 'SELL');

        return [$opening, $this->statement('2020-02-29', $closingQuantity)];
    }

    private function parameters(PortfolioSnapshot $opening, PortfolioSnapshot $closing): array
    {
        return ['opening_snapshot_id' => $opening->id, 'closing_snapshot_id' => $closing->id];
    }

    private function preview(PortfolioSnapshot $opening, PortfolioSnapshot $closing, array $extra = [], ?InvestmentAccount $account = null)
    {
        return $this->postJson('/api/investment-accounts/'.($account ?? $this->account)->id.'/reconciliation', [...$this->parameters($opening, $closing), ...$extra]);
    }

    private function proof(array $result): array
    {
        return ['confirmed' => true, 'input_version' => $result['input_version'], 'source_ids' => array_column($result['evidence']['sources'], 'id')];
    }

    private function verified(PortfolioSnapshot $opening, PortfolioSnapshot $closing): array
    {
        $initial = $this->preview($opening, $closing)->assertOk()->json('data');

        return $this->preview($opening, $closing, ['coverage' => $this->proof($initial)])->assertOk()->json('data');
    }

    private function save(PortfolioSnapshot $opening, PortfolioSnapshot $closing, array $result)
    {
        return $this->postJson('/api/investment-accounts/'.$this->account->id.'/reconciliation-runs', [
            ...$this->parameters($opening, $closing), 'expected_input_version' => $result['input_version'], 'coverage' => $this->proof($result),
        ]);
    }

    public function test_exact_quantities_match_only_with_validated_sources_and_version_bound_user_attestation(): void
    {
        [$opening, $closing] = $this->fixture();
        $result = $this->verified($opening, $closing);
        $this->assertSame('MATCHED', $result['status']);
        $this->assertSame(1, $result['counts']['MATCHED']);
        $this->assertSame('0', $result['items'][0]['difference']);
        $this->assertSame('120', $result['items'][0]['calculated_quantity']);
        $this->assertSame('USER_ATTESTED_PERIOD', $result['coverage']['basis']);
        $this->assertCount(2, $result['items'][0]['transaction_evidence']);
        $this->assertCount(4, $result['evidence']['sources']);
        $this->assertDatabaseCount('transactions', 2);
        $this->assertDatabaseCount('reconciliation_runs', 0);
    }

    public function test_numerically_equal_with_unknown_activity_is_incomplete(): void
    {
        [$opening, $closing] = $this->fixture();
        $response = $this->preview($opening, $closing)->assertOk()->assertJsonPath('data.status', 'INCOMPLETE')->assertJsonPath('data.items.0.numerical_comparison', 'EQUAL');
        $this->assertContains('NUMERICALLY_EQUAL_BUT_COVERAGE_UNVERIFIED', $response->json('data.items.0.diagnostics'));
        $this->assertSame(0, $response->json('data.counts.MATCHED'));
    }

    public function test_verified_quantity_difference_is_exact_mismatch_without_adjustment_trade(): void
    {
        [$opening, $closing] = $this->fixture('110');
        $result = $this->verified($opening, $closing);
        $this->assertSame('MISMATCH', $result['status']);
        $this->assertSame('-10', $result['items'][0]['difference']);
        $this->assertContains('QUANTITY_MISMATCH', $result['items'][0]['diagnostics']);
        $this->assertDatabaseCount('transactions', 2);
    }

    public function test_difference_with_unknown_coverage_remains_provisional_and_does_not_assert_a_missing_trade(): void
    {
        [$opening, $closing] = $this->fixture('110');
        $response = $this->preview($opening, $closing)->assertOk()->assertJsonPath('data.status', 'INCOMPLETE')->assertJsonPath('data.items.0.difference', '-10');
        $this->assertContains('PROVISIONAL_QUANTITY_DIFFERENCE', $response->json('data.items.0.diagnostics'));
        $this->assertContains('POSSIBLE_MISSING_OR_UNSUPPORTED_ACTIVITY', $response->json('data.items.0.diagnostics'));
        $this->assertContains('CORPORATE_ACTION', $response->json('data.items.0.possible_causes'));
    }

    public function test_monthly_only_change_is_observed_position_change_and_never_fabricated_buy_sell(): void
    {
        $opening = $this->statement('2020-01-31');
        $closing = $this->statement('2020-02-29', '150');
        $this->preview($opening, $closing)->assertOk()->assertJsonPath('data.status', 'INCOMPLETE')
            ->assertJsonPath('data.items.0.observed_position_change', '50')->assertJsonPath('data.items.0.accepted_buy_quantity', '0')
            ->assertJsonPath('data.items.0.observed_change_basis', 'POSITION_CHANGE_NOT_TRADE_ACTIVITY');
        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_unresolved_duplicate_is_pending_review_and_cannot_be_overridden_by_coverage(): void
    {
        [$opening, $closing] = $this->fixture();
        $this->trade()->assertJsonPath('results.0.status', 'PENDING_REVIEW');
        $response = $this->preview($opening, $closing)->assertOk()->assertJsonPath('data.status', 'PENDING_REVIEW')->assertJsonPath('data.items.0.difference', null);
        $this->preview($opening, $closing, ['coverage' => $this->proof($response->json('data'))])->assertOk()->assertJsonPath('data.status', 'PENDING_REVIEW');
        $this->assertDatabaseCount('transactions', 2);
    }

    public function test_late_arrival_changes_effective_period_and_invalidates_prior_coverage_confirmation(): void
    {
        [$opening, $closing] = $this->fixture();
        $before = $this->verified($opening, $closing);
        $this->trade('2020-02-20', '5', 'SELL');
        $response = $this->preview($opening, $closing, ['coverage' => $this->proof($before), 'previous_input_version' => $before['input_version']])->assertOk()
            ->assertJsonPath('data.previous_input_stale', true)->assertJsonPath('data.status', 'INCOMPLETE')->assertJsonPath('data.items.0.calculated_quantity', '115')->assertJsonPath('data.items.0.difference', '5');
        $this->assertContains('COVERAGE_CONFIRMATION_STALE', $response->json('data.coverage.reasons'));
        $this->assertNotSame($before['input_version'], $response->json('data.input_version'));
        $this->assertSame('MISMATCH', $this->verified($opening, $closing)['status']);
    }

    public function test_historical_result_is_immutable_and_marked_stale_on_read(): void
    {
        [$opening, $closing] = $this->fixture();
        $result = $this->verified($opening, $closing);
        $saved = $this->save($opening, $closing, $result)->assertCreated()->json('run_id');
        $original = (array) DB::table('reconciliation_runs')->sole();
        $this->trade('2020-02-20', '5', 'SELL');
        $this->getJson('/api/investment-accounts/'.$this->account->id.'/reconciliation-runs/'.$saved)->assertOk()
            ->assertJsonPath('freshness', 'STALE')->assertJsonPath('is_current', false)->assertJsonPath('result.status', 'MATCHED')->assertJsonPath('result.items.0.difference', '0');
        $this->assertSame($original, (array) DB::table('reconciliation_runs')->sole());
        $this->getJson('/api/investment-accounts/'.$this->account->id.'/reconciliation-runs')->assertOk()->assertJsonPath('data.0.freshness', 'STALE');
    }

    public function test_identical_recomputation_and_history_save_are_deterministic_and_idempotent(): void
    {
        [$opening, $closing] = $this->fixture();
        $one = $this->verified($opening, $closing);
        $two = $this->verified($opening, $closing);
        $this->assertSame($one['input_version'], $two['input_version']);
        $this->assertSame($one['items'], $two['items']);
        $id = $this->save($opening, $closing, $one)->assertCreated()->json('run_id');
        $this->save($opening, $closing, $two)->assertOk()->assertJsonPath('replayed', true)->assertJsonPath('run_id', $id);
        $this->assertDatabaseCount('reconciliation_runs', 1);
        $this->assertDatabaseCount('reconciliation_items', 1);
    }

    public function test_stale_save_precondition_does_not_publish_a_result_for_changed_inputs(): void
    {
        [$opening, $closing] = $this->fixture();
        $before = $this->verified($opening, $closing);
        $this->trade('2020-02-20', '5', 'SELL');
        $this->save($opening, $closing, $before)->assertConflict();
        $this->assertDatabaseCount('reconciliation_runs', 0);
    }

    public function test_partial_or_unknown_closing_absence_is_null_not_zero(): void
    {
        foreach (['PARTIAL', 'UNKNOWN'] as $index => $coverage) {
            $account = $index ? $this->account('bions') : $this->account;
            $opening = $this->statement('2020-01-31', account: $account);
            $closing = $this->statement('2020-02-29', null, $coverage, account: $account);
            $this->preview($opening, $closing, account: $account)->assertOk()->assertJsonPath('data.status', 'INCOMPLETE')->assertJsonPath('data.items.0.reported_quantity', null)->assertJsonPath('data.items.0.difference', null);
        }
    }

    public function test_unknown_unit_and_same_date_snapshot_conflict_never_match(): void
    {
        [$opening, $closing] = $this->fixture();
        $this->statement('2020-02-29', '120', unit: 'UNKNOWN', confirm: false);
        $this->preview($opening, $closing)->assertOk()->assertJsonPath('data.status', 'PENDING_REVIEW')->assertJsonPath('data.items.0.difference', null);
        $account = $this->account('bions');
        $otherOpening = $this->statement('2020-01-31', account: $account);
        $unknown = $this->statement('2020-02-29', unit: 'UNKNOWN', account: $account, confirm: false);
        $response = $this->preview($otherOpening, $unknown, account: $account)->assertOk()->assertJsonPath('data.counts.MATCHED', 0);
        foreach ($response->json('data.items') as $row) {
            $this->assertNull($row['difference']);
        }
    }

    public function test_cash_dividend_does_not_change_reconciliation_quantity(): void
    {
        $account = $this->account('bions');
        $opening = $this->statement('2020-01-31', account: $account);
        $this->trade(account: $account);
        $this->trade('2020-02-15', '0', 'DIVIDEND', $account, ['reference_quantity' => '999999', 'unit' => 'UNKNOWN']);
        $closing = $this->statement('2020-02-29', '130', account: $account);
        $this->preview($opening, $closing, account: $account)->assertOk()->assertJsonPath('data.items.0.calculated_quantity', '130')->assertJsonPath('data.items.0.difference', '0');
    }

    public function test_crypto_decimal_difference_and_full_empty_closing_are_exact(): void
    {
        $account = $this->account('pluang');
        $opening = $this->statement('2020-01-31', '0.10000001', unit: 'COIN', account: $account);
        $closing = $this->statement('2020-02-29', '0.10000002', unit: 'COIN', account: $account);
        $this->preview($opening, $closing, account: $account)->assertOk()->assertJsonPath('data.items.0.difference', '0.00000001');
        $empty = $this->statement('2020-03-31', null, account: $account);
        $this->preview($closing, $empty, account: $account)->assertOk()->assertJsonPath('data.items.0.reported_quantity', '0')->assertJsonPath('data.items.0.difference', '-0.10000002');
    }

    public function test_zero_activity_empty_full_snapshots_require_explicit_period_attestation(): void
    {
        $opening = $this->statement('2020-01-31', null);
        $closing = $this->statement('2020-02-29', null);
        $this->preview($opening, $closing)->assertOk()->assertJsonPath('data.status', 'INCOMPLETE')->assertJsonPath('data.items', []);
        $this->assertSame('MATCHED', $this->verified($opening, $closing)['status']);
        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_account_provider_owner_and_nested_evidence_isolation(): void
    {
        [$opening, $closing] = $this->fixture();
        $otherAccount = $this->account('bions');
        $otherClosing = $this->statement('2020-02-29', account: $otherAccount);
        $this->preview($opening, $otherClosing)->assertNotFound();
        $own = $this->preview($opening, $closing)->assertOk()->json('data');
        $foreignSource = app(SnapshotBaselineSelector::class)->describe($otherClosing, $otherAccount)['source']['id'];
        $this->preview($opening, $closing, ['coverage' => [...$this->proof($own), 'source_ids' => [$foreignSource]]])->assertUnprocessable();
        $saved = $this->save($opening, $closing, $this->verified($opening, $closing))->assertCreated()->json('run_id');
        $this->getJson('/api/investment-accounts/'.$otherAccount->id.'/reconciliation-runs/'.$saved)->assertNotFound();
        $this->actingAs(User::factory()->create());
        $this->preview($opening, $closing)->assertNotFound();
        $this->getJson('/api/investment-accounts/'.$this->account->id.'/reconciliation-runs/'.$saved)->assertNotFound();
    }

    public function test_invalid_self_comparison_dates_and_raw_payload_are_rejected(): void
    {
        [$opening, $closing] = $this->fixture();
        $this->preview($opening, $opening)->assertUnprocessable();
        $this->preview($closing, $opening)->assertUnprocessable();
        $this->preview($opening, $closing, ['timezone' => 'Asia/Jakarta'])->assertUnprocessable();
        $this->preview($opening, $closing, ['password' => 'SYNTHETIC_PRIVATE', 'difference' => '0'])->assertUnprocessable();
        $response = $this->preview($opening, $closing)->assertOk();
        $this->assertStringNotContainsString('document_hash', $response->getContent());
        $this->assertStringNotContainsString('structured_data', $response->getContent());
    }

    public function test_comparison_works_with_history_schema_pending_and_does_not_run_migrations(): void
    {
        [$opening, $closing] = $this->fixture();
        Schema::shouldReceive('hasTable')->with('reconciliation_runs')->andReturn(false);
        $result = $this->preview($opening, $closing)->assertOk()->assertJsonPath('history_available', false)->json('data');
        $this->save($opening, $closing, $result)->assertStatus(503)->assertJsonPath('code', 'HISTORY_SCHEMA_PENDING');
        $this->getJson('/api/investment-accounts/'.$this->account->id.'/reconciliation-runs')->assertOk()->assertJsonPath('available', false);
        $this->assertDatabaseCount('reconciliation_runs', 0);
    }

    public function test_unvalidated_transaction_and_ambiguous_timestamp_cannot_become_verified_matches(): void
    {
        $opening = $this->statement('2020-01-31');
        $this->trade('2020-02-10T09:00:00Z', extra: ['date_precision' => 'TIMESTAMP']);
        $closing = $this->statement('2020-02-29', '130');
        $this->preview($opening, $closing)->assertOk()->assertJsonPath('data.status', 'INCOMPLETE')->assertJsonPath('data.items.0.calculated_quantity', null);
        $response = $this->preview($opening, $closing, ['timezone' => 'Asia/Jakarta', 'cutoff' => '23:59:59'])->assertOk()->assertJsonPath('data.items.0.difference', '0');
        $this->preview($opening, $closing, ['timezone' => 'Asia/Jakarta', 'cutoff' => '23:59:59', 'coverage' => $this->proof($response->json('data'))])->assertOk()->assertJsonPath('data.status', 'MATCHED');
        Transaction::sole()->update(['validation_status' => 'REJECTED']);
        $this->preview($opening, $closing, ['timezone' => 'Asia/Jakarta', 'cutoff' => '23:59:59'])->assertOk()->assertJsonPath('data.items.0.calculated_quantity', null);
    }

    public function test_missing_source_evidence_is_not_overridden_by_user_attestation(): void
    {
        [$opening, $closing] = $this->fixture();
        DB::table('source_observations')->whereNotNull('transaction_id')->delete();
        $response = $this->preview($opening, $closing)->assertOk();
        $verified = $this->preview($opening, $closing, ['coverage' => $this->proof($response->json('data'))])->assertOk()->assertJsonPath('data.status', 'INCOMPLETE');
        $this->assertContains('TRANSACTION_SOURCE_EVIDENCE_MISSING', $verified->json('data.reasons'));
    }

    public function test_closing_only_asset_uses_zero_opening_only_from_a_full_confirmed_universe(): void
    {
        $opening = $this->statement('2020-01-31', null);
        $closing = $this->statement('2020-02-29', '5');
        $response = $this->preview($opening, $closing)->assertOk()->assertJsonPath('data.items.0.opening_quantity', '0')
            ->assertJsonPath('data.items.0.calculated_quantity', '0')->assertJsonPath('data.items.0.difference', '5');
        $this->assertTrue($response->json('data.items.0.opening_absence_inferred_zero'));
        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_equal_partial_positions_cannot_match_even_with_activity_attestation(): void
    {
        $opening = $this->statement('2020-01-31');
        $closing = $this->statement('2020-02-29', '100', 'PARTIAL');
        $result = $this->verified($opening, $closing);
        $this->assertSame('INCOMPLETE', $result['status']);
        $this->assertSame('0', $result['items'][0]['difference']);
        $this->assertContains('NUMERICALLY_EQUAL_BUT_COVERAGE_UNVERIFIED', $result['items'][0]['diagnostics']);
    }

    public function test_empty_or_false_attestation_and_missing_references_are_rejected(): void
    {
        [$opening, $closing] = $this->fixture();
        $result = $this->preview($opening, $closing)->assertOk()->json('data');
        $this->preview($opening, $closing, ['coverage' => []])->assertUnprocessable();
        $this->preview($opening, $closing, ['coverage' => [...$this->proof($result), 'confirmed' => false]])->assertUnprocessable();
        $this->preview($opening, $closing, ['coverage' => [...$this->proof($result), 'source_ids' => array_slice($this->proof($result)['source_ids'], 0, 1)]])->assertUnprocessable();
    }

    public function test_edit_removing_an_accepted_transaction_invalidates_confirmation_without_rebinding_old_sources(): void
    {
        [$opening, $closing] = $this->fixture();
        $before = $this->verified($opening, $closing);
        $transaction = Transaction::orderBy('id')->first();
        $this->patchJson('/api/transactions/'.$transaction->id, ['quantity' => '31'])->assertOk();
        $result = $this->preview($opening, $closing, ['coverage' => $this->proof($before)])->assertOk()->assertJsonPath('data.coverage.confirmed', false)->json('data');
        $this->assertContains('COVERAGE_CONFIRMATION_STALE', $result['coverage']['reasons']);
        $this->assertSame('PENDING_REVIEW', $result['status']);
    }

    public function test_reconciliation_endpoints_require_authentication(): void
    {
        auth()->forgetGuards();
        $this->postJson('/api/investment-accounts/'.$this->account->id.'/reconciliation', [])->assertUnauthorized();
        $this->getJson('/api/investment-accounts/'.$this->account->id.'/reconciliation-runs')->assertUnauthorized();
    }
}
