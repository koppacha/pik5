<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LimitLog extends Model
{
    use HasFactory;

    protected $table = 'limit_logs';

    // まとめて挿入したいので guard しない
    protected $guarded = [];

    // JSON/日時のキャスト
    protected $casts = [
        'stacked_card_ids'      => 'array',
        'card_snapshot'         => 'array',
        'player_snapshot'       => 'array',
        'context'               => 'array',
        'previous_limit'        => 'datetime',
        'new_limit'             => 'datetime',
        'created_at'            => 'datetime',
        'updated_at'            => 'datetime',
        'rank_points_delta'     => 'integer',
        'draw_points_delta'     => 'integer',
        'remaining_draw_points' => 'integer',
        'remaining_deck_count'  => 'integer',
        'hand_count'            => 'integer',
        'rewards'               => 'integer',
        'top_user_id'           => 'integer',
        'top_score'             => 'integer',
        'records_count'         => 'integer',
        'card_id'               => 'integer',
        'stage_id'              => 'integer',
        'affected_player_id'    => 'integer',
    ];
}
