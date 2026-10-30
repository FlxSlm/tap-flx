<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AutomaticIngestion extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['locator', 'structured_payload', 'message_part_hash'];

    protected $casts = ['locator' => 'encrypted:array', 'structured_payload' => 'encrypted:array', 'receipt' => 'array'];
}
