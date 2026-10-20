<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Transaction extends Model
{
    protected $fillable = [
        'investment_account_id',
        'transaction_date',
        'type',
        'symbol',
        'asset_name',
        'quantity',
        'price',
        'total_amount',
        'currency',
        'fee_amount',
        'external_identifier',
        'transaction_hash',
        'source_metadata',
        'gross_amount', 'net_amount', 'tax_amount', 'settlement_amount',
        'amount_semantics', 'unit', 'date_precision', 'reference_quantity',
        'imported_at', 'validation_status', 'review_status', 'revision',
    ];

    protected $casts = [
        'transaction_date' => 'datetime',
        'quantity' => 'decimal:8',
        'price' => 'decimal:8',
        'total_amount' => 'decimal:4',
        'fee_amount' => 'decimal:4',
        'source_metadata' => 'array',
        'gross_amount' => 'decimal:4',
        'net_amount' => 'decimal:4',
        'tax_amount' => 'decimal:4',
        'settlement_amount' => 'decimal:4',
        'reference_quantity' => 'decimal:8',
        'imported_at' => 'datetime',
    ];

    public function investmentAccount()
    {
        return $this->belongsTo(InvestmentAccount::class);
    }
}
