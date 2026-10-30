<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ImportSchemaReadinessTest extends TestCase
{
    use RefreshDatabase;

    public function test_pending_foundation_is_actionable_and_does_not_attempt_import(): void
    {
        $this->actingAs(User::factory()->create());
        Schema::shouldReceive('hasTable')->once()->with('source_observations')->andReturn(false);
        $this->postJson('/api/source-imports', [])->assertStatus(503)->assertJsonPath('code', 'SOURCE_SCHEMA_PENDING');
        $this->assertDatabaseCount('transactions', 0);
        $this->assertDatabaseCount('portfolio_snapshots', 0);
    }
}
