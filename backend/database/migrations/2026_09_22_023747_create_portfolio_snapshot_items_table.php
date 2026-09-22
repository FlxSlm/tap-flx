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
        Schema::create('portfolio_snapshot_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('portfolio_snapshot_id')->constrained()->onDelete('cascade');
            $table->string('symbol');
            $table->string('asset_name')->nullable();
            $table->decimal('quantity', 24, 8);
            $table->decimal('average_price', 24, 8)->nullable();
            $table->decimal('market_price', 24, 8)->nullable();
            $table->decimal('market_value', 24, 4)->nullable();
            $table->string('currency')->default('IDR');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('portfolio_snapshot_items');
    }
};
