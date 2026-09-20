<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Player extends Model
{
    protected $guarded = [];

    protected $casts = [
        'event_id' => 'integer',
        'draw_points' => 'integer',
        'rank_points' => 'integer',
        'card_count' => 'integer',
        'subsidy_flag' => 'boolean',
        'subsidy_flag_slot_at' => 'datetime',
        'last_subsidy_paid_slot_at' => 'datetime',
        'last_take_at' => 'datetime',
        'take_count' => 'integer',
        'take_cooldown_released_for' => 'datetime',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(TrickEvent::class, 'event_id', 'event_id');
    }
}
