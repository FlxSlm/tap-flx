<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reconciliation_runs', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('investment_account_id')->constrained()->restrictOnDelete();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('opening_snapshot_id')->constrained('portfolio_snapshots')->restrictOnDelete();
            $table->foreignId('closing_snapshot_id')->constrained('portfolio_snapshots')->restrictOnDelete();
            $table->char('input_version', 64);
            $table->char('result_fingerprint', 64);
            $table->string('rule_version', 40);
            $table->string('status', 20);
            $table->json('parameters');
            $table->json('summary');
            $table->dateTime('created_at');
            $table->unique(['investment_account_id', 'result_fingerprint'], 'reconciliation_account_result_unique');
            $table->index(['investment_account_id', 'created_at'], 'reconciliation_account_created_idx');
        });
        Schema::create('reconciliation_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reconciliation_run_id')->constrained()->restrictOnDelete();
            $table->string('symbol', 30);
            $table->string('unit', 20);
            $table->string('status', 20);
            // Decimal strings inside JSON preserve exactness on SQLite and MariaDB alike.
            $table->json('result');
            $table->unique(['reconciliation_run_id', 'symbol', 'unit'], 'reconciliation_item_asset_unique');
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Reconciliation history cannot be dropped by automatic rollback; use a reviewed recovery plan.');
    }
};
