<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrickCardHolder extends Model
{
    protected $guarded = [];

    protected $casts = [
        'event_id' => 'integer',
        'event_card_id' => 'integer',
        'deck_id' => 'integer',
    ];
}
