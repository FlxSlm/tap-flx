<?php

namespace Tests\Feature;

use App\Models\InvestmentAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvestmentAccountOnboardingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
    }

    public function test_empty_database_can_onboard_an_owned_account_without_sensitive_identifiers(): void
    {
        $owner = User::factory()->create();
        $this->actingAs($owner)->getJson('/api/investment-accounts')->assertOk()->assertExactJson(['data' => []]);
        $this->postJson('/api/investment-accounts', ['provider' => 'stockbit', 'account_name' => '  Portfolio   pribadi  '])
            ->assertCreated()->assertJsonPath('data.platform_code', 'stockbit')->assertJsonPath('data.account_name', 'Portfolio pribadi');
        $account = InvestmentAccount::sole();
        $this->assertSame($owner->id, $account->user_id);
        $this->assertNull($account->account_identifier);
        $this->assertNull($account->email_connection_id);
        $this->getJson('/api/investment-accounts')->assertJsonCount(1, 'data');
    }

    public function test_all_supported_providers_can_be_created_explicitly(): void
    {
        $this->actingAs(User::factory()->create());
        foreach (['stockbit', 'bions', 'pluang'] as $provider) {
            $this->postJson('/api/investment-accounts', ['provider' => $provider, 'account_name' => 'Synthetic '.$provider])
                ->assertCreated()->assertJsonPath('data.platform_code', $provider);
        }
        $this->assertDatabaseCount('investment_accounts', 3);
        $this->assertDatabaseCount('platforms', 3);
    }

    public function test_case_insensitive_duplicate_label_replays_for_same_owner_and_provider_only(): void
    {
        $first = User::factory()->create();
        $second = User::factory()->create();
        $payload = ['provider' => 'stockbit', 'account_name' => 'Synthetic Account'];
        $id = $this->actingAs($first)->postJson('/api/investment-accounts', $payload)->assertCreated()->json('data.id');
        $this->postJson('/api/investment-accounts', [...$payload, 'account_name' => 'synthetic account'])->assertOk()->assertJsonPath('already_exists', true)->assertJsonPath('data.id', $id);
        $this->postJson('/api/investment-accounts', [...$payload, 'provider' => 'bions'])->assertCreated();
        $this->actingAs($second)->getJson('/api/investment-accounts')->assertExactJson(['data' => []]);
        $this->postJson('/api/investment-accounts', $payload)->assertCreated();
        $this->getJson('/api/investment-accounts')->assertJsonCount(1, 'data');
        $this->assertDatabaseCount('investment_accounts', 3);
    }

    public function test_invalid_provider_labels_and_ownership_injection_are_rejected(): void
    {
        $this->actingAs(User::factory()->create());
        foreach ([['provider' => 'unknown', 'account_name' => 'Synthetic'], ['provider' => 'stockbit', 'account_name' => ''], ['provider' => 'stockbit', 'account_name' => '<script>bad</script>'], ['provider' => 'stockbit', 'account_name' => "Label\nsecret"], ['provider' => 'stockbit', 'account_name' => '123456789'], ['provider' => 'stockbit', 'account_name' => 'Synthetic', 'user_id' => 999], ['provider' => 'stockbit', 'account_name' => 'Synthetic', 'account_identifier' => 'SYNTHETIC_PRIVATE_MARKER']] as $payload) {
            $this->postJson('/api/investment-accounts', $payload)->assertUnprocessable();
        }
        $this->assertDatabaseCount('investment_accounts', 0);
        $this->assertDatabaseCount('platforms', 0);
    }

    public function test_creation_requires_authentication(): void
    {
        $this->postJson('/api/investment-accounts', ['provider' => 'stockbit', 'account_name' => 'Synthetic'])->assertUnauthorized();
    }
}
