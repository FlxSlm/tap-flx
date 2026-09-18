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
    ];

    protected $casts = [
        'transaction_date' => 'datetime',
        'quantity' => 'decimal:8',
        'price' => 'decimal:8',
        'total_amount' => 'decimal:4',
        'fee_amount' => 'decimal:4',
        'source_metadata' => 'array',
    ];

    public function investmentAccount()
    {
        return $this->belongsTo(InvestmentAccount::class);
    }
}
