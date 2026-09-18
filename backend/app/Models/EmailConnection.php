<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmailConnection extends Model
{
    protected $fillable = [
        'user_id',
        'email_address',
        'oauth_provider',
        'oauth_id',
        'credentials',
        'is_active',
        'last_sync_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'last_sync_at' => 'datetime',
        'credentials' => 'encrypted',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function investmentAccounts()
    {
        return $this->hasMany(InvestmentAccount::class);
    }
}
