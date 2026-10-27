<?php

namespace Tests\Feature;

use App\Models\PortfolioSnapshot;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DocumentOnboardingFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_account_four_item_statement_receipt_replay_and_reported_positions_persist_across_requests(): void
    {
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        $this->actingAs(User::factory()->create());
        $account = $this->postJson('/api/investment-accounts', ['provider' => 'stockbit', 'account_name' => 'Synthetic Import'])->assertCreated()->json('data.id');
        $items = array_map(fn ($symbol) => ['symbol' => $symbol, 'quantity' => '0.12345678', 'average_price' => null, 'market_price' => null, 'market_value' => null, 'unit' => 'UNKNOWN', 'currency' => 'IDR'], ['TSTA', 'TSTB', 'TSTC', 'TSTD']);
        $body = ['schema_version' => 'integrity-v1', 'investment_account_id' => $account, 'confirmed' => true, 'idempotency_key' => 'synthetic-onboard-statement',
            'source' => ['provider' => 'STOCKBIT', 'source_type' => 'PDF', 'document_type' => 'SOA', 'document_hash' => hash('sha256', 'synthetic-onboard-statement'), 'parser_version' => 'synthetic@1'],
            'transactions' => [], 'snapshot' => ['as_of_date' => '2020-01-31', 'coverage' => 'UNKNOWN', 'coverage_confirmed' => false, 'parsed_item_count' => 4, 'items' => $items]];
        $import = $this->postJson('/api/source-imports', $body)->assertOk()->json();
        $this->getJson('/api/source-imports/'.$import['batch_id'])->assertOk()->assertJsonPath('current_observations.0.review_status', 'REQUIRED');
        $this->postJson('/api/source-imports', $body)->assertOk()->assertJsonPath('replayed', true)->assertJsonPath('batch_id', $import['batch_id']);
        $url = '/api/investment-accounts/'.$account.'/holdings?as_of=2020-01-31';
        foreach ([1, 2] as $request) {
            $this->getJson($url)->assertOk()->assertJsonCount(4, 'reported.snapshots.0.items')->assertJsonPath('reported.snapshots.0.coverage', 'UNKNOWN')
                ->assertJsonPath('reported.snapshots.0.items.0.quantity', '0.12345678')->assertJsonPath('reported.snapshots.0.items.0.unit', 'UNKNOWN');
        }
        $this->assertDatabaseCount('portfolio_snapshots', 1);
        $this->assertDatabaseCount('portfolio_snapshot_items', 4);
        $this->assertDatabaseCount('transactions', 0);
        $this->assertNull(PortfolioSnapshot::sole()->items()->first()->average_price);
        $foreign = $this->postJson('/api/investment-accounts', ['provider' => 'bions', 'account_name' => 'Synthetic Wrong Provider'])->assertCreated()->json('data.id');
        $this->postJson('/api/source-imports', [...$body, 'investment_account_id' => $foreign])->assertUnprocessable();
        $this->actingAs(User::factory()->create())->getJson($url)->assertNotFound();
    }
}
