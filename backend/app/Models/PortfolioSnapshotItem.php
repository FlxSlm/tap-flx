<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PortfolioSnapshotItem extends Model
{
    protected $guarded = [];

    protected $casts = [
        'quantity' => 'decimal:8',
        'average_price' => 'decimal:8',
        'market_price' => 'decimal:8',
        'market_value' => 'decimal:4',
    ];

    public function snapshot()
    {
        return $this->belongsTo(PortfolioSnapshot::class, 'portfolio_snapshot_id');
    }
}
