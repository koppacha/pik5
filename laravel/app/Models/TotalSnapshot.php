<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TotalSnapshot extends Model
{
    use HasFactory;

    protected $fillable = [
        'target_year',
        'target_month',
        'snapshot_at',
        'user',
        'rule',
        'score',
        'rps',
        'mark',
        'rank',
        'flg',
    ];
}
