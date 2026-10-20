<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PortfolioSnapshot extends Model
{
    protected $guarded = [];

    protected $casts = [
        'source_metadata' => 'array',
        'as_of_date' => 'date',
        'coverage_confirmed' => 'boolean',
    ];

    public function items()
    {
        return $this->hasMany(PortfolioSnapshotItem::class);
    }

    public function investmentAccount()
    {
        return $this->belongsTo(InvestmentAccount::class);
    }
}
