<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrickCardPayment extends Model
{
    protected $guarded = [];

    protected $casts = [
        'event_id' => 'integer',
        'event_card_id' => 'integer',
        'deck_id' => 'integer',
        'stage_id' => 'integer',
        'submission_number' => 'integer',
        'points_paid' => 'integer',
        'record_id' => 'integer',
    ];
}
