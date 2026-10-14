<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Deck extends Model
{
    protected $guarded = [];

    public function eventCards(): HasMany
    {
        return $this->hasMany(TrickEventCard::class);
    }
}
