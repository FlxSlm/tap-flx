<?php

namespace Tests\Feature;

use App\Models\EmailConnection;
use App\Models\InvestmentAccount;
use App\Models\Platform;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvestmentAccountApiTest extends TestCase
{
    use RefreshDatabase;

    private $user1;
    private $user2;
    private $investmentAccount1;
    private $investmentAccount2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user1 = User::factory()->create();
        $this->user2 = User::factory()->create();

        $platform = Platform::create(['code' => 'stockbit', 'name' => 'Stockbit']);

        $email1 = EmailConnection::create([
            'user_id' => $this->user1->id,
            'email_address' => 'user1@example.com'
        ]);

        $email2 = EmailConnection::create([
            'user_id' => $this->user2->id,
            'email_address' => 'user2@example.com'
        ]);

        $this->investmentAccount1 = InvestmentAccount::create([
            'user_id' => $this->user1->id,
            'platform_id' => $platform->id,
            'email_connection_id' => $email1->id,
        ]);

        $this->investmentAccount2 = InvestmentAccount::create([
            'user_id' => $this->user2->id,
            'platform_id' => $platform->id,
            'email_connection_id' => $email2->id,
        ]);
    }

    public function test_unauthenticated_user_cannot_access_accounts()
    {
        $response = $this->getJson('/api/investment-accounts');
        $response->assertStatus(401);
    }

    public function test_authenticated_user_can_only_see_their_own_accounts()
    {
        $response = $this->actingAs($this->user1)->getJson('/api/investment-accounts');
        
        $response->assertStatus(200);
        $response->assertJsonCount(1, 'data');
        $this->assertEquals($this->investmentAccount1->id, $response->json('data.0.id'));
        $this->assertEquals('stockbit', $response->json('data.0.platform_code'));
    }
}
