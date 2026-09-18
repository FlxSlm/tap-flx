<?php

namespace Tests\Feature;

use App\Models\EmailConnection;
use App\Models\InvestmentAccount;
use App\Models\Platform;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TransactionApiTest extends TestCase
{
    use RefreshDatabase;

    private $user1;
    private $user2;
    private $investmentAccount1;
    private $investmentAccount2;

    protected function setUp(): void
    {
        parent::setUp();

        // Setup test data
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

    public function test_unauthenticated_user_rejected()
    {
        $response = $this->getJson('/api/transactions');
        $response->assertStatus(401);
    }

    public function test_authenticated_user_can_create_transaction()
    {
        $payload = [
            'investment_account_id' => $this->investmentAccount1->id,
            'transaction_date' => '2023-10-01 10:00:00',
            'type' => 'BUY',
            'symbol' => 'BBCA',
            'quantity' => 100,
            'price' => 10000,
            'total_amount' => 1000000,
            'currency' => 'IDR'
        ];

        $response = $this->actingAs($this->user1)->postJson('/api/transactions', $payload);

        $response->assertStatus(201);
        $this->assertDatabaseHas('transactions', [
            'investment_account_id' => $this->investmentAccount1->id,
            'symbol' => 'BBCA'
        ]);
    }

    public function test_user_cannot_create_transaction_for_others_account()
    {
        $payload = [
            'investment_account_id' => $this->investmentAccount2->id, // Belongs to user2
            'transaction_date' => '2023-10-01 10:00:00',
            'type' => 'BUY',
            'symbol' => 'BBCA',
            'quantity' => 100,
            'price' => 10000,
            'total_amount' => 1000000,
            'currency' => 'IDR'
        ];

        $response = $this->actingAs($this->user1)->postJson('/api/transactions', $payload);
        $response->assertStatus(403);
    }

    public function test_user_can_only_read_own_transactions()
    {
        // Give user1 a transaction
        Transaction::create([
            'investment_account_id' => $this->investmentAccount1->id,
            'transaction_date' => now(),
            'type' => 'BUY',
            'symbol' => 'BBCA',
            'quantity' => 10,
            'price' => 10,
            'total_amount' => 100,
            'transaction_hash' => 'hash1'
        ]);

        // Give user2 a transaction
        Transaction::create([
            'investment_account_id' => $this->investmentAccount2->id,
            'transaction_date' => now(),
            'type' => 'BUY',
            'symbol' => 'GOTO',
            'quantity' => 10,
            'price' => 10,
            'total_amount' => 100,
            'transaction_hash' => 'hash2'
        ]);

        $response = $this->actingAs($this->user1)->getJson('/api/transactions');
        
        $response->assertStatus(200);
        $response->assertJsonCount(1, 'data');
        $this->assertEquals('BBCA', $response->json('data.0.symbol'));
    }

    public function test_duplicate_transaction_hash_handled()
    {
        $payload = [
            'investment_account_id' => $this->investmentAccount1->id,
            'transaction_date' => '2023-10-01 10:00:00',
            'type' => 'BUY',
            'symbol' => 'BBCA',
            'quantity' => 100,
            'price' => 10000,
            'total_amount' => 1000000,
            'currency' => 'IDR'
        ];

        // First insert
        $this->actingAs($this->user1)->postJson('/api/transactions', $payload)->assertStatus(201);
        
        // Second insert (exact same payload)
        $response = $this->actingAs($this->user1)->postJson('/api/transactions', $payload);
        
        // Should be 409 Conflict as handled in controller
        $response->assertStatus(409);
        $response->assertJsonPath('message', 'Duplicate transaction detected.');
        
        // Ensure only 1 was inserted
        $this->assertEquals(1, Transaction::count());
    }

    public function test_invalid_payload_validation_error()
    {
        $payload = [
            'investment_account_id' => $this->investmentAccount1->id,
            // Missing type, symbol, qty, price etc
        ];

        $response = $this->actingAs($this->user1)->postJson('/api/transactions', $payload);
        $response->assertStatus(422);
    }
    
    public function test_update_transaction_ownership()
    {
        $transaction = Transaction::create([
            'investment_account_id' => $this->investmentAccount1->id,
            'transaction_date' => now(),
            'type' => 'BUY',
            'symbol' => 'BBCA',
            'quantity' => 10,
            'price' => 10,
            'total_amount' => 100,
            'transaction_hash' => 'hash_update'
        ]);

        // user2 tries to update user1's transaction
        $response = $this->actingAs($this->user2)->putJson('/api/transactions/' . $transaction->id, ['quantity' => 20]);
        $response->assertStatus(403);

        // user1 updates it
        $response = $this->actingAs($this->user1)->putJson('/api/transactions/' . $transaction->id, ['quantity' => 20]);
        $response->assertStatus(200);
        $this->assertEquals(20, $transaction->fresh()->quantity);
    }

    public function test_delete_transaction_ownership()
    {
        $transaction = Transaction::create([
            'investment_account_id' => $this->investmentAccount1->id,
            'transaction_date' => now(),
            'type' => 'BUY',
            'symbol' => 'BBCA',
            'quantity' => 10,
            'price' => 10,
            'total_amount' => 100,
            'transaction_hash' => 'hash_delete'
        ]);

        // user2 tries to delete user1's transaction
        $response = $this->actingAs($this->user2)->deleteJson('/api/transactions/' . $transaction->id);
        $response->assertStatus(403);

        // user1 deletes it
        $response = $this->actingAs($this->user1)->deleteJson('/api/transactions/' . $transaction->id);
        $response->assertStatus(200);
        $this->assertDatabaseMissing('transactions', ['id' => $transaction->id]);
    }
}
