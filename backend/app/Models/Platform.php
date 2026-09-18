<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Platform extends Model
{
    protected $fillable = [
        'code',
        'name',
    ];

    public function investmentAccounts()
    {
        return $this->hasMany(InvestmentAccount::class);
    }
}
