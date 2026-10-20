<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class IntegrityMigrationTest extends TestCase
{
    public function test_additive_upgrade_preserves_legacy_values_and_marks_unknowns(): void
    {
        $original = DB::getDefaultConnection();
        $originalSchema = Schema::getFacadeRoot();
        config(['database.connections.gate1_legacy' => [
            'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true,
        ]]);
        DB::setDefaultConnection('gate1_legacy');
        Schema::swap(DB::connection('gate1_legacy')->getSchemaBuilder());
        try {
            $upgrade = base_path('database/migrations/2026_10_20_000001_add_source_integrity_foundation.php');
            foreach (glob(base_path('database/migrations/*.php')) as $file) {
                if ($file !== $upgrade) {
                    (require $file)->up();
                }
            }
            DB::table('users')->insert(['id' => 1, 'name' => 'Synthetic', 'email' => 'fixture@example.test', 'password' => 'synthetic-not-a-login-hash']);
            DB::table('platforms')->insert(['id' => 1, 'code' => 'stockbit', 'name' => 'Stockbit']);
            DB::table('investment_accounts')->insert(['id' => 1, 'user_id' => 1, 'platform_id' => 1]);
            DB::table('transactions')->insert(['id' => 1, 'investment_account_id' => 1, 'transaction_date' => '2020-01-02 00:00:00', 'type' => 'BUY', 'symbol' => 'TSTA', 'quantity' => '10', 'price' => '100', 'total_amount' => '1000', 'transaction_hash' => 'synthetic-legacy-hash']);
            DB::table('portfolio_snapshots')->insert(['id' => 1, 'investment_account_id' => 1, 'as_of_date' => '2020-01-31', 'provider' => 'STOCKBIT', 'snapshot_hash' => 'synthetic-legacy-snapshot']);
            DB::table('portfolio_snapshot_items')->insert(['portfolio_snapshot_id' => 1, 'symbol' => 'TSTA', 'quantity' => '10']);
            $before = (array) DB::table('transactions')->sole();
            (require $upgrade)->up();
            $after = (array) DB::table('transactions')->sole();
            $this->assertSame($before, array_intersect_key($after, $before));
            $this->assertSame('UNKNOWN', $after['amount_semantics']);
            $this->assertSame('LEGACY_UNVERIFIED', $after['validation_status']);
            $this->assertNull($after['gross_amount']);
            $this->assertNull($after['net_amount']);
            $this->assertNull($after['imported_at']);
            $this->assertSame('UNKNOWN', DB::table('portfolio_snapshots')->sole()->coverage);
            $this->assertSame(1, DB::table('portfolio_snapshot_items')->count());
        } finally {
            Schema::swap($originalSchema);
            DB::setDefaultConnection($original);
            DB::purge('gate1_legacy');
        }
    }
}
