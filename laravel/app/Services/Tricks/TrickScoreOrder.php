<?php
namespace App\Services\Tricks;
use App\Models\Deck;
class TrickScoreOrder
{
    public static function ascending(?Deck $deck): bool
    {
        if ($deck?->score_type !== 'time') return false;
        if ($deck->score_order === 'desc') return false;
        if ($deck->score_order === 'asc') return true;
        $origin = (int) $deck->origin_stage_id;
        return ! ((int) $deck->stage_id === 1356 || ($origin >= 419 && $origin <= 428));
    }
}
