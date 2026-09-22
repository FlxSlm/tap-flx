<?php

namespace Tests\Feature;

use App\Models\InvestmentAccount;
use App\Models\User;
use App\Models\Platform;
use App\Models\EmailConnection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PortfolioSnapshotApiTest extends TestCase
{
    use RefreshDatabase;

    private $user;
    private $investmentAccount;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->user = User::factory()->create();
        $platform = Platform::create(['code' => 'stockbit', 'name' => 'Stockbit']);
        $email = EmailConnection::create(['user_id' => $this->user->id, 'email_address' => 'test@test.com']);
        $this->investmentAccount = InvestmentAccount::create([
            'user_id' => $this->user->id,
            'platform_id' => $platform->id,
            'email_connection_id' => $email->id,
        ]);
    }

    public function test_can_bulk_store_snapshots()
    {
        $payload = [
            'snapshots' => [
                [
                    'investment_account_id' => $this->investmentAccount->id,
                    'as_of_date' => '2026-08-31',
                    'provider' => 'STOCKBIT',
                    'document_type' => 'SOA',
                    'items' => [
                        [
                            'symbol' => 'BBCA',
                            'quantity' => 100,
                            'average_price' => 5000,
                            'market_value' => 550000
                        ]
                    ]
                ]
            ]
        ];

        $response = $this->actingAs($this->user)->postJson('/api/portfolio-snapshots/bulk', $payload);

        $response->assertStatus(200);
        $response->assertJsonCount(1, 'successful');
        $this->assertDatabaseHas('portfolio_snapshots', ['provider' => 'STOCKBIT']);
        $this->assertDatabaseHas('portfolio_snapshot_items', ['symbol' => 'BBCA']);
    }
}
