<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TrickEvent extends Model
{
    protected $guarded = [];

    protected $casts = [
        'start_at' => 'datetime',
        'end_at' => 'datetime',
        'debug' => 'boolean',
        'test_mode' => 'boolean',
        'debug_now' => 'datetime',
        'last_subsidy_slot_at' => 'datetime',
        'initialized_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public function cards(): HasMany
    {
        return $this->hasMany(TrickEventCard::class, 'event_id', 'event_id');
    }

    public function players(): HasMany
    {
        return $this->hasMany(Player::class, 'event_id', 'event_id');
    }
}
