<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrickEventRecord extends Model
{
    protected $guarded = [];

    public function record(): BelongsTo
    {
        return $this->belongsTo(Record::class, 'record_id', 'post_id');
    }
}
