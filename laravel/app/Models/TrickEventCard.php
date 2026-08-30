<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TrickEventCard extends Model
{
    protected $guarded = [];

    protected $casts = [
        'difficulty' => 'integer',
        'rarity' => 'integer',
        'stack_count' => 'integer',
        'post_count' => 'integer',
        'paid_points_total' => 'integer',
        'limit_at' => 'datetime',
        'taken_at' => 'datetime',
        'collected_at' => 'datetime',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(TrickEvent::class, 'event_id', 'event_id');
    }

    public function deck(): BelongsTo
    {
        return $this->belongsTo(Deck::class);
    }

    public function records(): HasMany
    {
        return $this->hasMany(TrickEventRecord::class, 'event_card_id');
    }
}
