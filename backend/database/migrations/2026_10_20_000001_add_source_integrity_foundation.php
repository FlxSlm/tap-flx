<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('source_documents', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('investment_account_id')->constrained()->restrictOnDelete();
            $table->string('provider', 20);
            $table->string('source_type', 10);
            $table->string('document_type', 30);
            $table->char('document_hash', 64);
            $table->string('parser_version', 60);
            $table->dateTime('imported_at');
            $table->timestamps();
            $table->unique(['investment_account_id', 'document_hash'], 'source_account_hash_unique');
        });

        Schema::create('import_batches', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('investment_account_id')->constrained()->restrictOnDelete();
            $table->foreignId('source_document_id')->constrained()->restrictOnDelete();
            $table->string('idempotency_key', 80);
            $table->char('payload_hash', 64);
            $table->json('receipt')->nullable();
            $table->timestamps();
            $table->unique(['investment_account_id', 'idempotency_key'], 'batch_account_key_unique');
        });

        Schema::table('transactions', function (Blueprint $table) {
            foreach (['gross_amount', 'net_amount', 'tax_amount', 'settlement_amount'] as $amount) {
                $table->decimal($amount, 24, 4)->nullable();
            }
            $table->string('amount_semantics', 20)->default('UNKNOWN');
            $table->string('unit', 20)->default('UNKNOWN');
            $table->string('date_precision', 10)->default('TIMESTAMP');
            $table->decimal('reference_quantity', 24, 8)->nullable();
            $table->dateTime('imported_at')->nullable();
            $table->string('validation_status', 30)->default('LEGACY_UNVERIFIED');
            $table->string('review_status', 20)->default('REQUIRED');
            $table->unsignedInteger('revision')->default(1);
            $table->index(['investment_account_id', 'transaction_date'], 'transaction_account_date_idx');
        });

        Schema::table('portfolio_snapshots', function (Blueprint $table) {
            $table->foreignId('source_document_id')->nullable()->constrained()->restrictOnDelete();
            $table->string('coverage', 10)->default('UNKNOWN');
            $table->boolean('coverage_confirmed')->default(false);
            $table->string('activity_coverage', 10)->default('UNKNOWN');
            $table->string('review_status', 20)->default('REQUIRED');
            $table->unsignedInteger('parsed_item_count')->nullable();
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();
        });

        Schema::table('portfolio_snapshot_items', function (Blueprint $table) {
            $table->string('unit', 20)->default('UNKNOWN');
        });

        Schema::create('source_observations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_document_id')->constrained()->restrictOnDelete();
            $table->foreignId('import_batch_id')->constrained()->restrictOnDelete();
            $table->string('row_key', 80);
            $table->string('kind', 20);
            $table->char('payload_hash', 64);
            $table->json('structured_data');
            $table->foreignId('transaction_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('portfolio_snapshot_id')->nullable()->constrained()->nullOnDelete();
            $table->json('candidate_ids')->nullable();
            $table->unsignedTinyInteger('confidence')->nullable();
            $table->string('validation_status', 30);
            $table->string('review_status', 20);
            $table->string('status', 30);
            $table->timestamps();
            $table->unique(['source_document_id', 'row_key'], 'observation_source_row_unique');
        });

        Schema::create('integrity_audit_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('investment_account_id')->constrained()->restrictOnDelete();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->string('action', 40);
            $table->foreignId('source_document_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('import_batch_id')->nullable()->constrained()->restrictOnDelete();
            // Preserve the original ID even if a legacy transaction is deleted.
            $table->unsignedBigInteger('transaction_record_id')->nullable();
            $table->json('before_state')->nullable();
            $table->json('after_state')->nullable();
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        // Intentionally non-destructive. A reviewed restore/forward fix is required.
        throw new RuntimeException('Integrity evidence migration cannot be rolled back automatically.');
    }
};
