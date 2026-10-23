<?php

namespace App\Services;

use App\Library\Func;

class StageRecordRanking
{
    /** Same best-score/oldest-tie selection as the stage ranking page. */
    public static function best(array $rows, int $stage, int $rule): array
    {
        $rows = Func::sortRecordsByRule($rows, $stage, $rule);
        $seen = [];
        return array_values(array_filter($rows, static function ($row) use (&$seen) {
            $user = $row['user_id'];
            if (isset($seen[$user])) return false;
            $seen[$user] = true;
            return true;
        }));
    }
}
