<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('investment_accounts', function (Blueprint $table) {
            $table->string('acquisition_mode', 16)->default('PRIVACY');
            $table->unsignedInteger('acquisition_epoch')->default(0);
            $table->uuid('ingestion_public_id')->nullable()->unique();
            $table->string('sync_status', 40)->default('PAUSED');
            $table->timestamp('automatic_last_sync_at')->nullable();
            $table->text('automatic_page_token')->nullable();
            $table->uuid('sync_lease')->nullable();
            $table->timestamp('sync_started_at')->nullable();
        });
        Schema::create('automatic_ingestions', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('investment_account_id')->constrained()->restrictOnDelete();
            $table->foreignId('email_connection_id')->constrained()->restrictOnDelete();
            $table->char('message_part_hash', 64);
            $table->unsignedInteger('policy_epoch');
            $table->string('status', 40);
            // Application-encrypted; never store PDF, raw text, email body or PDF password.
            $table->longText('locator');
            $table->longText('structured_payload')->nullable();
            $table->json('receipt')->nullable();
            $table->timestamps();
            $table->unique(['investment_account_id', 'message_part_hash'], 'automatic_account_message_unique');
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Automatic ingestion evidence requires an owner-reviewed restore or forward migration.');
    }
};
