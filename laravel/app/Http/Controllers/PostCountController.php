<?php

namespace App\Http\Controllers;

use App\Models\Record;
use DateTime;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PostCountController extends Controller
{
    // ユーザーごとの年初来の投稿数をカウントする
    public function get(): JsonResponse
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
            ->groupBy('user_id')
            ->orderBy('cnt', "DESC")
            ->limit(12)
            ->get()
            ->toArray();

        return response()->json(
            $dataset
        );
    }
}
