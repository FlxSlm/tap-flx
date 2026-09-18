<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InvestmentAccount extends Model
{
    protected $fillable = [
        'user_id',
        'platform_id',
        'email_connection_id',
        'account_identifier',
        'account_name',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function platform()
    {
        return $this->belongsTo(Platform::class);
    }

    public function emailConnection()
    {
        return $this->belongsTo(EmailConnection::class);
    }

    public function transactions()
    {
        return $this->hasMany(Transaction::class);
    }
}
