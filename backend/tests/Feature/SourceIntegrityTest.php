<?php

namespace Tests\Feature;

use App\Models\InvestmentAccount;
use App\Models\Platform;
use App\Models\PortfolioSnapshot;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SourceIntegrityTest extends TestCase
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
        $platform = Platform::create(['code' => 'stockbit', 'name' => 'Stockbit']);
        $this->account = InvestmentAccount::create(['user_id' => $this->owner->id, 'platform_id' => $platform->id, 'account_name' => 'Synthetic fixture account']);
        $this->actingAs($this->owner);
    }

    private function transaction(array $overrides = []): array
    {
        return [...[
            'transaction_date' => '2020-01-02', 'date_precision' => 'DATE',
            'type' => 'BUY', 'symbol' => 'TSTA', 'unit' => 'SHARE', 'currency' => 'IDR',
            'quantity' => '10', 'price' => '100', 'gross_amount' => '1000',
            'net_amount' => '1003', 'fee_amount' => '2', 'tax_amount' => '1',
            'settlement_amount' => null, 'total_amount' => '1000', 'amount_semantics' => 'GROSS',
        ], ...$overrides];
    }

    private function envelope(string $key = 'synthetic-batch-1', string $doc = 'synthetic-doc-1', array $row = []): array
    {
        return [
            'schema_version' => 'integrity-v1', 'investment_account_id' => $this->account->id,
            'confirmed' => true, 'idempotency_key' => $key,
            'source' => ['provider' => 'STOCKBIT', 'source_type' => 'PDF', 'document_type' => 'TC', 'document_hash' => hash('sha256', $doc), 'parser_version' => 'synthetic@1'],
            'transactions' => [['row_key' => 'synthetic-row-1', ...$this->transaction($row)]],
        ];
    }

    public function test_gross_net_fee_tax_remain_separate_with_provenance(): void
    {
        $response = $this->postJson('/api/source-imports', $this->envelope())->assertOk()->assertJsonPath('results.0.status', 'CREATED');
        $tx = Transaction::sole();
        $this->assertSame('1000.0000', $tx->gross_amount);
        $this->assertSame('1003.0000', $tx->net_amount);
        $this->assertSame('2.0000', $tx->fee_amount);
        $this->assertSame('1.0000', $tx->tax_amount);
        $this->assertNull($tx->settlement_amount);
        $this->assertNotNull($tx->imported_at);
        $this->assertDatabaseHas('source_observations', ['transaction_id' => $tx->id, 'status' => 'CREATED', 'validation_status' => 'PASSED']);
        $this->assertDatabaseHas('source_documents', ['public_id' => $response->json('source_document_id'), 'parser_version' => 'synthetic@1']);
    }

    public function test_unknown_trade_unit_remains_required_review_instead_of_becoming_an_accepted_event(): void
    {
        $this->postJson('/api/source-imports', $this->envelope(row: ['unit' => 'UNKNOWN']))->assertOk()->assertJsonPath('results.0.review_status', 'REQUIRED');
        $this->assertSame('REQUIRED', Transaction::sole()->review_status);
        $this->assertDatabaseHas('source_observations', ['review_status' => 'REQUIRED']);
        $this->assertSame('UNKNOWN', json_decode(DB::table('source_observations')->sole()->structured_data, true)['unit']);
    }

    public function test_stock_statement_provider_cannot_accept_coin_trade_unit(): void
    {
        $this->postJson('/api/source-imports', $this->envelope(row: ['unit' => 'COIN']))->assertUnprocessable();
        $this->assertDatabaseCount('transactions', 0);
        $this->assertDatabaseCount('source_documents', 0);
    }

    public function test_missing_fee_and_tax_stay_null_instead_of_zero(): void
    {
        $this->postJson('/api/source-imports', $this->envelope(row: ['fee_amount' => null, 'tax_amount' => null]))->assertOk();
        $this->assertNull(Transaction::sole()->fee_amount);
        $this->assertNull(Transaction::sole()->tax_amount);
    }

    public function test_inconsistent_known_amounts_are_rejected_without_writes(): void
    {
        $this->postJson('/api/source-imports', $this->envelope(row: ['net_amount' => '900']))->assertUnprocessable();
        $this->assertDatabaseCount('transactions', 0);
        $this->assertDatabaseCount('source_documents', 0);
    }

    public function test_inconsistent_explicit_total_basis_is_rejected(): void
    {
        $this->postJson('/api/source-imports', $this->envelope(row: ['amount_semantics' => 'NET']))->assertUnprocessable();
    }

    public function test_hash_changes_on_edit_and_audit_records_previous_identity(): void
    {
        $this->postJson('/api/source-imports', $this->envelope())->assertOk();
        $tx = Transaction::sole();
        $hash = $tx->transaction_hash;
        $this->putJson('/api/transactions/'.$tx->id, ['symbol' => 'TSTB'])->assertOk();
        $this->assertNotSame($hash, $tx->fresh()->transaction_hash);
        $this->assertSame(2, $tx->fresh()->revision);
        $event = DB::table('integrity_audit_events')->where('action', 'TRANSACTION_UPDATED')->sole();
        $this->assertSame($hash, json_decode($event->before_state, true)['transaction_hash']);
        $this->assertDatabaseHas('source_observations', ['transaction_id' => $tx->id, 'review_status' => 'REQUIRED']);
    }

    public function test_edit_that_collides_with_another_event_is_rejected_atomically(): void
    {
        $data = ['investment_account_id' => $this->account->id, ...$this->transaction()];
        $one = $this->postJson('/api/transactions', $data)->assertCreated()->json('data.id');
        $two = $this->postJson('/api/transactions', [...$data, 'symbol' => 'TSTB'])->assertCreated()->json('data.id');
        $hash = Transaction::findOrFail($two)->transaction_hash;
        $this->putJson('/api/transactions/'.$two, ['symbol' => 'TSTA'])->assertConflict();
        $this->assertSame($hash, Transaction::findOrFail($two)->transaction_hash);
        $this->assertNotSame($one, $two);
    }

    public function test_legacy_duplicate_and_legacy_unknown_semantics_regression(): void
    {
        $data = ['investment_account_id' => (string) $this->account->id, ...$this->transaction()];
        unset($data['gross_amount'], $data['net_amount'], $data['tax_amount'], $data['amount_semantics']);
        $this->postJson('/api/transactions', $data)->assertCreated()->assertJsonPath('data.amount_semantics', 'UNKNOWN');
        $this->postJson('/api/transactions', $data)->assertConflict();
        $this->assertDatabaseCount('transactions', 1);
    }

    public function test_import_key_replay_is_idempotent_and_changed_body_conflicts(): void
    {
        $payload = $this->envelope();
        $first = $this->postJson('/api/source-imports', $payload)->assertOk();
        $second = $this->postJson('/api/source-imports', $payload)->assertOk()->assertJsonPath('replayed', true);
        $this->assertSame($first->json('batch_id'), $second->json('batch_id'));
        $payload['transactions'][0]['symbol'] = 'TSTB';
        $this->postJson('/api/source-imports', $payload)->assertConflict();
        $this->assertDatabaseCount('transactions', 1);
        $this->assertDatabaseCount('import_batches', 1);
    }

    public function test_same_source_row_with_new_batch_does_not_create_transaction_twice(): void
    {
        $this->postJson('/api/source-imports', $this->envelope())->assertOk();
        $this->postJson('/api/source-imports', $this->envelope(key: 'new-batch'))->assertOk()->assertJsonPath('results.0.status', 'REPLAYED');
        $this->assertDatabaseCount('transactions', 1);
        $this->assertDatabaseCount('source_observations', 1);
    }

    public function test_changed_same_source_row_is_a_conflict_not_a_silent_overwrite(): void
    {
        $this->postJson('/api/source-imports', $this->envelope())->assertOk();
        $this->postJson('/api/source-imports', $this->envelope('different-batch', row: ['symbol' => 'TSTB']))->assertOk()->assertJsonPath('results.0.status', 'SOURCE_CONFLICT');
        $this->assertSame('TSTA', Transaction::sole()->symbol);
    }

    public function test_soa_and_tc_without_verified_shared_identity_are_held_for_review(): void
    {
        $this->postJson('/api/source-imports', $this->envelope())->assertOk();
        $soa = $this->envelope('soa-batch', 'synthetic-soa', ['total_amount' => '1003', 'amount_semantics' => 'NET']);
        $soa['source']['document_type'] = 'SOA';
        $this->postJson('/api/source-imports', $soa)->assertOk()->assertJsonPath('results.0.status', 'PENDING_REVIEW');
        $this->assertDatabaseCount('transactions', 1);
        $this->assertDatabaseCount('source_observations', 2);
    }

    public function test_explicit_compatible_user_confirmed_link_retains_both_sources(): void
    {
        $this->postJson('/api/source-imports', $this->envelope())->assertOk();
        $payload = $this->envelope('reviewed-batch', 'different-source');
        $payload['transactions'][0]['match_transaction_id'] = Transaction::sole()->id;
        $this->postJson('/api/source-imports', $payload)->assertOk()->assertJsonPath('results.0.status', 'LINKED_EXISTING');
        $this->assertDatabaseCount('transactions', 1);
        $this->assertSame(2, DB::table('source_observations')->where('transaction_id', Transaction::sole()->id)->count());
    }

    public function test_identical_legitimate_trade_without_reference_is_not_automatically_collapsed(): void
    {
        $this->postJson('/api/source-imports', $this->envelope())->assertOk();
        $this->postJson('/api/source-imports', $this->envelope('second-trade', 'synthetic-second-trade'))->assertOk()->assertJsonPath('results.0.status', 'PENDING_REVIEW');
    }

    public function test_pending_observation_can_be_explicitly_linked_with_a_new_confirmation_batch(): void
    {
        $this->postJson('/api/source-imports', $this->envelope())->assertOk();
        $pending = $this->envelope('pending-batch', 'synthetic-soa');
        $pending['source']['document_type'] = 'SOA';
        $this->postJson('/api/source-imports', $pending)->assertOk()->assertJsonPath('results.0.status', 'PENDING_REVIEW');
        $pending['idempotency_key'] = 'resolution-batch';
        $pending['transactions'][0]['match_transaction_id'] = Transaction::sole()->id;
        $this->postJson('/api/source-imports', $pending)->assertOk()->assertJsonPath('results.0.status', 'LINKED_EXISTING');
        $this->assertDatabaseCount('transactions', 1);
        $this->assertDatabaseHas('integrity_audit_events', ['action' => 'SOURCE_LINK_CONFIRMED', 'transaction_record_id' => Transaction::sole()->id]);
    }

    private function snapshotPayload(string $coverage = 'UNKNOWN'): array
    {
        $payload = $this->envelope();
        $payload['source']['document_type'] = 'SOA';
        $payload['transactions'] = [];
        $payload['snapshot'] = ['as_of_date' => '2020-01-31', 'coverage' => $coverage, 'parsed_item_count' => 2, 'items' => [['symbol' => 'TSTA', 'quantity' => '10', 'unit' => 'SHARE', 'currency' => 'IDR']]];

        return $payload;
    }

    public function test_partial_snapshot_and_monthly_only_import_do_not_create_ledger_events(): void
    {
        $this->postJson('/api/source-imports', $this->snapshotPayload('PARTIAL'))->assertOk()->assertJsonPath('results.0.coverage', 'PARTIAL');
        $this->assertDatabaseCount('transactions', 0);
        $this->assertDatabaseHas('portfolio_snapshots', ['coverage' => 'PARTIAL', 'activity_coverage' => 'UNKNOWN']);
        $this->assertNotNull(PortfolioSnapshot::sole()->source_document_id);
    }

    public function test_omitted_coverage_defaults_to_unknown_not_full(): void
    {
        $payload = $this->snapshotPayload();
        unset($payload['snapshot']['coverage']);
        $this->postJson('/api/source-imports', $payload)->assertOk();
        $this->assertSame('UNKNOWN', PortfolioSnapshot::sole()->coverage);
    }

    public function test_full_snapshot_requires_confirmation_and_all_parsed_positions(): void
    {
        $payload = $this->snapshotPayload('FULL');
        $this->postJson('/api/source-imports', $payload)->assertUnprocessable();
        $payload['snapshot']['coverage_confirmed'] = true;
        $this->postJson('/api/source-imports', $payload)->assertUnprocessable();
        $payload['snapshot']['parsed_item_count'] = 1;
        $this->postJson('/api/source-imports', $payload)->assertOk();
        $this->assertSame('UNKNOWN', PortfolioSnapshot::sole()->activity_coverage);
    }

    public function test_explicit_empty_full_position_snapshot_does_not_invent_trades(): void
    {
        $payload = $this->snapshotPayload('FULL');
        $payload['snapshot']['coverage_confirmed'] = true;
        $payload['snapshot']['parsed_item_count'] = 0;
        $payload['snapshot']['items'] = [];
        $this->postJson('/api/source-imports', $payload)->assertOk();
        $this->assertDatabaseCount('portfolio_snapshots', 1);
        $this->assertDatabaseCount('portfolio_snapshot_items', 0);
        $this->assertDatabaseCount('transactions', 0);
    }

    public function test_same_date_new_document_is_reviewable_not_an_overwrite(): void
    {
        $payload = $this->snapshotPayload();
        $this->postJson('/api/source-imports', $payload)->assertOk();
        $payload['idempotency_key'] = 'another-snapshot';
        $payload['source']['document_hash'] = hash('sha256', 'different-statement');
        $this->postJson('/api/source-imports', $payload)->assertOk()->assertJsonPath('results.0.status', 'PENDING_REVIEW');
        $this->assertDatabaseCount('portfolio_snapshots', 2);
    }

    public function test_other_users_cannot_import_or_use_foreign_match_target(): void
    {
        $this->postJson('/api/source-imports', $this->envelope())->assertOk();
        $other = User::factory()->create();
        $this->actingAs($other)->postJson('/api/source-imports', $this->envelope('foreign'))->assertForbidden();
        $otherAccount = InvestmentAccount::create(['user_id' => $other->id, 'platform_id' => $this->account->platform_id]);
        $payload = $this->envelope('foreign-match');
        $payload['investment_account_id'] = $otherAccount->id;
        $payload['transactions'][0]['match_transaction_id'] = Transaction::sole()->id;
        $this->postJson('/api/source-imports', $payload)->assertUnprocessable();
        $this->assertDatabaseCount('transactions', 1);
        $this->assertDatabaseCount('source_documents', 1);
    }

    public function test_provider_mismatch_and_unsupported_email_source_are_rejected(): void
    {
        $payload = $this->envelope();
        $payload['source']['provider'] = 'BIONS';
        $this->postJson('/api/source-imports', $payload)->assertUnprocessable();
        $payload = $this->envelope();
        $payload['source']['source_type'] = 'EMAIL';
        $this->postJson('/api/source-imports', $payload)->assertUnprocessable();
    }

    public function test_private_raw_fields_are_rejected_and_legacy_metadata_is_not_persisted(): void
    {
        $payload = $this->envelope();
        $payload['source']['password'] = 'synthetic-forbidden-value';
        $this->postJson('/api/source-imports', $payload)->assertUnprocessable();
        $data = ['investment_account_id' => $this->account->id, ...$this->transaction(), 'source_metadata' => ['raw_text' => 'synthetic-forbidden-value']];
        $this->postJson('/api/transactions', $data)->assertCreated();
        $this->assertNull(Transaction::sole()->source_metadata);
    }

    public function test_dividend_uses_reference_balance_without_fabricating_quantity_or_price(): void
    {
        $platform = Platform::create(['code' => 'bions', 'name' => 'BIONS']);
        $this->account->update(['platform_id' => $platform->id]);
        $payload = $this->envelope(row: ['type' => 'DIVIDEND', 'quantity' => null, 'reference_quantity' => '10', 'price' => null, 'gross_amount' => '50', 'net_amount' => '45', 'tax_amount' => '5', 'fee_amount' => null, 'total_amount' => '45', 'amount_semantics' => 'NET']);
        $payload['source']['provider'] = 'BIONS';
        $payload['source']['document_type'] = 'CA';
        $this->postJson('/api/source-imports', $payload)->assertOk();
        $tx = Transaction::sole();
        $this->assertNull($tx->quantity);
        $this->assertNull($tx->price);
        $this->assertSame('10.00000000', $tx->reference_quantity);
    }

    public function test_unknown_numeric_fields_are_not_silently_rounded_or_signed(): void
    {
        $this->postJson('/api/source-imports', $this->envelope(row: ['quantity' => '0.000000001']))->assertUnprocessable();
        $this->postJson('/api/source-imports', $this->envelope(row: ['quantity' => '-1']))->assertUnprocessable();
    }

    public function test_same_user_accounts_do_not_cross_match(): void
    {
        $this->postJson('/api/source-imports', $this->envelope())->assertOk();
        $second = InvestmentAccount::create(['user_id' => $this->owner->id, 'platform_id' => $this->account->platform_id]);
        $payload = $this->envelope('same-key-independent-account');
        $payload['investment_account_id'] = $second->id;
        $this->postJson('/api/source-imports', $payload)->assertOk()->assertJsonPath('results.0.status', 'CREATED');
        $this->assertDatabaseCount('transactions', 2);
    }

    public function test_provenance_receipt_read_is_owner_scoped_and_contains_no_raw_payload(): void
    {
        $response = $this->postJson('/api/source-imports', $this->envelope())->assertOk();
        $url = '/api/source-imports/'.$response->json('batch_id');
        $this->getJson($url)->assertOk()->assertJsonPath('source.provider', 'STOCKBIT')->assertJsonMissingPath('source.document_hash')->assertJsonMissingPath('current_observations.0.structured_data');
        $this->actingAs(User::factory()->create())->getJson($url)->assertNotFound();
    }

    public function test_invalid_bulk_shapes_are_validation_errors_not_server_errors(): void
    {
        $this->postJson('/api/transactions/bulk', ['transactions' => ['not-an-object']])->assertUnprocessable();
        $this->postJson('/api/portfolio-snapshots/bulk', ['snapshots' => ['not-an-object']])->assertUnprocessable();
        $payload = $this->snapshotPayload('FULL');
        $payload['snapshot']['coverage_confirmed'] = true;
        $payload['snapshot']['items'] = 'not-an-array';
        $this->postJson('/api/source-imports', $payload)->assertUnprocessable();
    }

    public function test_deleted_source_link_is_preserved_for_audit_and_cannot_be_resurrected_by_reimport(): void
    {
        $this->postJson('/api/source-imports', $this->envelope())->assertOk();
        $id = Transaction::sole()->id;
        $this->deleteJson('/api/transactions/'.$id)->assertOk();
        $this->postJson('/api/source-imports', $this->envelope('reimport-after-delete'))->assertOk()->assertJsonPath('results.0.status', 'PENDING_REVIEW');
        $this->assertDatabaseCount('transactions', 0);
        $this->assertDatabaseHas('source_observations', ['transaction_id' => null, 'status' => 'TARGET_DELETED']);
        $this->assertDatabaseHas('integrity_audit_events', ['action' => 'TRANSACTION_DELETED', 'transaction_record_id' => $id]);
    }

    public function test_cross_source_financial_disagreement_is_reviewed_not_inserted_twice(): void
    {
        $this->postJson('/api/source-imports', $this->envelope())->assertOk();
        $payload = $this->envelope('disagreement', 'different-statement', ['net_amount' => '1004', 'fee_amount' => '3']);
        $payload['source']['document_type'] = 'SOA';
        $this->postJson('/api/source-imports', $payload)->assertOk()->assertJsonPath('results.0.status', 'PENDING_REVIEW');
        $this->assertDatabaseCount('transactions', 1);
        $payload['idempotency_key'] = 'incompatible-link';
        $payload['transactions'][0]['match_transaction_id'] = Transaction::sole()->id;
        $this->postJson('/api/source-imports', $payload)->assertUnprocessable();
    }

    public function test_structured_snapshot_cannot_invent_a_missing_currency(): void
    {
        $payload = $this->snapshotPayload();
        unset($payload['snapshot']['items'][0]['currency']);
        $this->postJson('/api/source-imports', $payload)->assertUnprocessable();
        $this->assertDatabaseCount('portfolio_snapshots', 0);
    }

    public function test_invalid_legacy_numeric_row_is_preserved_and_triggers_review_instead_of_a_server_error(): void
    {
        Transaction::create(['investment_account_id' => $this->account->id, 'transaction_date' => '2020-01-02 00:00:00', 'type' => 'BUY', 'symbol' => 'TSTA', 'quantity' => '-10', 'price' => '100', 'total_amount' => '1000', 'currency' => 'IDR', 'transaction_hash' => 'synthetic-invalid-legacy']);
        $this->postJson('/api/source-imports', $this->envelope())->assertOk()->assertJsonPath('results.0.status', 'PENDING_REVIEW');
        $this->assertDatabaseCount('transactions', 1);
        $this->assertSame('-10.00000000', Transaction::sole()->quantity);
    }
}
