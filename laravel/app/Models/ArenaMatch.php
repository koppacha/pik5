<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ArenaMatch extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'receiver_user_ids' => 'array',
    ];
}
