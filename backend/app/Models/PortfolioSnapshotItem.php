<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PortfolioSnapshotItem extends Model
{
    protected $guarded = [];

    public function snapshot()
    {
        return $this->belongsTo(PortfolioSnapshot::class, 'portfolio_snapshot_id');
    }
}
