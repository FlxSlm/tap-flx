<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('investment_account_id')->constrained()->onDelete('cascade');
            $table->dateTime('transaction_date');
            $table->string('type'); // BUY, SELL, DEPOSIT, WITHDRAWAL, DIVIDEND, FEE
            $table->string('symbol')->nullable();
            $table->string('asset_name')->nullable();
            $table->decimal('quantity', 24, 8)->nullable();
            $table->decimal('price', 24, 8)->nullable();
            $table->decimal('total_amount', 24, 4);
            $table->string('currency')->default('IDR');
            $table->decimal('fee_amount', 24, 4)->nullable();
            $table->string('external_identifier')->nullable();
            $table->string('transaction_hash')->unique();
            $table->json('source_metadata')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
