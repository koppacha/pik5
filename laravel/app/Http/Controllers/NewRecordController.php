<?php

namespace App\Http\Controllers;

use App\Library\Func;
use App\Models\Record;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NewRecordController extends Controller
{
    public function get(): JsonResponse
    {
        // 記録をリクエスト
        $dataset = Record::where('stage_id', "<", 1000)
            ->where('flg','<', 2)
            ->orderBy("created_at","DESC")
            ->limit(50)
            ->get()
            ->toArray();

            return response()->json(
            $dataset
        );
    }
}
