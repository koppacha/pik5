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
            ->where('created_at', '>=', $date)
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
    public function getUserAllPostCount(Request $request): JsonResponse
    {
        $dataset = Record::select('user_id', Record::raw('MIN(created_at) as oldest_created_at'))
            ->selectRaw('COUNT(user_id) as cnt')
            ->where('flg','<', 2)
            ->where('user_id', $request["id"])
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
        $date = $datetime->modify('-1 month')->format("Y-m-d H:i:s");

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
    public function getPrevTrendPost(): JsonResponse
    {
        $datetime = new DateTime();

        // 時間を定義
        $trendFrom = (clone $datetime)->modify('-2 month')->format("Y-m-d H:i:s");
        $trendTo   = (clone $datetime)->modify('-1 month')->format("Y-m-d H:i:s");
        $postFrom = (clone $datetime)->setDate(date('Y') - 1, 1, 1)->format("Y-m-d H:i:s");
        $postTo = (clone $datetime)->setDate(date('Y'), 1, 1)->format("Y-m-d H:i:s");

        // 先月のトレンドをリクエスト
        $prevTrend = Record::select('stage_id')
            ->selectRaw('COUNT(stage_id) as cnt')
            ->where('created_at', '>=', $trendFrom)
            ->where('created_at', '<', $trendTo)
            ->where('stage_id', '<', 1000)
            ->where('flg','<', 2)
            ->groupBy('stage_id')
            ->orderBy('cnt', "DESC")
            ->limit(1)
            ->get()
            ->toArray();

        $prevPostCount = Record::with(['user' => function($q){
            // user_idに基づいてUserテーブルからユーザー名を取得する
            $q->select('user_name','user_id');
        }])
            ->select('user_id')
            ->selectRaw('COUNT(user_id) as cnt')
            ->where('created_at', '>=', $postFrom)
            ->where('created_at', '<', $postTo)
            ->where('flg','<', 2)
            ->groupBy('user_id')
            ->orderBy('cnt', "DESC")
            ->limit(1)
            ->get()
            ->toArray();

        return response()->json(
            ["trend" => $prevTrend,
             "post"  => $prevPostCount]
        );
    }
}
