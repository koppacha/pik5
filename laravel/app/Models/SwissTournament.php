<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SwissTournament extends Model
{
    protected $guarded = [];

    protected $casts = ['stage_pool' => 'array'];
}
