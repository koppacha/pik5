<?php

namespace App\Http\Controllers;

use App\Models\Record;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NewRecordController extends Controller
{
    public function get(): JsonResponse
    {
        // 記録をリクエスト
        $dataset = Record::with(['user' => function($q){
            // user_idに基づいてUserテーブルからユーザー名を取得する
            $q->select('user_name','user_id');
        }])
            // 絞り込み条件
            ->where('stage_id', "<", 1000)
            ->where('flg','<', 2)
            ->orderBy("created_at","DESC")
            ->limit(50)
            ->get();

        return response()->json(
            $dataset
        );
    }
}
