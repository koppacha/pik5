<?php

namespace App\Http\Controllers;

use App\Models\Record;
use DateTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PostCountController extends Controller
{
    // ユーザーごとの年初来の投稿数をカウントする
    public function getUserPostCount(): JsonResponse
    {
        $datetime = new DateTime(date('Y')."-01-01 00:00:00");
        $date = $datetime->format("Y-m-d H:i:s");

        $dataset = Record::with(['user' => function($q){
            // user_idに基づいてUserテーブルからユーザー名を取得する
            $q->select('user_name','user_id');
        }])
            ->select('user_id')
            ->selectRaw('COUNT(user_id) as cnt')
            ->where('created_at', '>', $date)
            ->where('flg','<', 2)
            ->groupBy('user_id')
            ->orderBy('cnt', "DESC")
            ->limit(12)
            ->get()
            ->toArray();

        return response()->json(
            $dataset
        );
    }
    // ユーザーごとの全期間の投稿数を集計して参加日を算出する
    public function getUserAllPostCount(): JsonResponse
    {
        $dataset = Record::select('user_id')
            ->selectRaw('COUNT(user_id) as cnt')
            ->where('flg','<', 2)
            ->groupBy('user_id')
            ->orderBy('cnt', "DESC")
            ->get()
            ->toArray();

        return response()->json(
            $dataset
        );
    }
    public function getTrendPostCount(): JsonResponse
    {
        $datetime = new DateTime();
        $date = $datetime->modify('-2 month')->format("Y-m-d H:i:s");

        // 記録をリクエスト
        $dataset = Record::select('stage_id')
            ->selectRaw('COUNT(stage_id) as cnt')
            ->where('created_at', '>', $date)
            ->where('stage_id', "<", 1000)
            ->where('flg','<', 2)
            ->groupBy('stage_id')
            ->orderBy('cnt', "DESC")
            ->limit(6)
            ->get()
            ->toArray();

        return response()->json(
            $dataset
        );
    }
}
