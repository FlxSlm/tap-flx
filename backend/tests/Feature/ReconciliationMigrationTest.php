<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ReconciliationMigrationTest extends TestCase
{
    public function test_additive_history_upgrade_preserves_existing_gate_two_financial_rows(): void
    {
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        $originalConnection = DB::getDefaultConnection();
        $originalSchema = Schema::getFacadeRoot();
        config(['database.connections.gate3_upgrade' => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true]]);
        DB::setDefaultConnection('gate3_upgrade');
        Schema::swap(DB::connection('gate3_upgrade')->getSchemaBuilder());
        try {
            $upgrade = base_path('database/migrations/2026_10_26_000001_add_reconciliation_history.php');
            foreach (glob(base_path('database/migrations/*.php')) as $file) {
                if ($file !== $upgrade) {
                    (require $file)->up();
                }
            }
            DB::table('users')->insert(['id' => 1, 'name' => 'Synthetic', 'email' => 'synthetic@example.test', 'password' => 'synthetic-not-a-login-hash']);
            DB::table('platforms')->insert(['id' => 1, 'code' => 'stockbit', 'name' => 'Stockbit']);
            DB::table('investment_accounts')->insert(['id' => 1, 'user_id' => 1, 'platform_id' => 1]);
            DB::table('portfolio_snapshots')->insert(['id' => 1, 'investment_account_id' => 1, 'as_of_date' => '2020-01-31', 'provider' => 'STOCKBIT', 'snapshot_hash' => 'synthetic-upgrade', 'coverage' => 'FULL', 'coverage_confirmed' => true, 'parsed_item_count' => 1, 'review_status' => 'CONFIRMED']);
            DB::table('portfolio_snapshot_items')->insert(['portfolio_snapshot_id' => 1, 'symbol' => 'TSTA', 'quantity' => '0.10000001', 'unit' => 'SHARE']);
            DB::table('transactions')->insert(['investment_account_id' => 1, 'transaction_date' => '2020-02-10', 'type' => 'BUY', 'symbol' => 'TSTA', 'unit' => 'SHARE', 'quantity' => '10', 'total_amount' => '100', 'transaction_hash' => 'synthetic-transaction', 'review_status' => 'CONFIRMED', 'validation_status' => 'PASSED']);
            $before = [];
            foreach (['transactions', 'portfolio_snapshots', 'portfolio_snapshot_items'] as $table) {
                $before[$table] = DB::table($table)->get()->toArray();
            }
            (require $upgrade)->up();
            foreach ($before as $table => $rows) {
                $this->assertEquals($rows, DB::table($table)->get()->toArray());
            }
            $this->assertTrue(Schema::hasTable('reconciliation_runs'));
            $this->assertTrue(Schema::hasTable('reconciliation_items'));
            $this->assertSame(0, DB::table('reconciliation_runs')->count());
        } finally {
            Schema::swap($originalSchema);
            DB::setDefaultConnection($originalConnection);
            DB::purge('gate3_upgrade');
        }
    }
}
