<?php

namespace App\Http\Controllers;

use App\Models\Record;
use App\Models\Keyword;
use App\Services\EventStampService;
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
    public function getUserAllPostCount(Request $request, EventStampService $eventStampService): JsonResponse
    {
        $dataset = Record::selectRaw('COUNT(user_id) as post_count')
            ->selectRaw('MIN(created_at) as first_posted_at')
            ->selectRaw('MAX(created_at) as last_posted_at')
            ->where('flg','<', 2)
            ->where('user_id', $request["id"])
            ->first();

        return response()->json([
            'post_count' => (int)($dataset?->post_count ?? 0),
            'first_posted_at' => $dataset?->first_posted_at,
            'last_posted_at' => $dataset?->last_posted_at,
            'keyword_edit_count' => Keyword::where('last_editor', $request['id'])->count(),
            'event_stamp_count' => $eventStampService->totalForUser((string)$request['id']),
        ]);
    }
    public function getTrendPostCount(): JsonResponse
    {
        // トレンドを取得する月数
        $trendCount = 12;

        // 現在の日時を取得
        $currentDate = new DateTime();

        // 集計データを格納する配列
        $result = [];

        // 投稿がある月だけを直近から12件取得する
        for ($i = 0; count($result) < $trendCount && $i < 240; $i++) {
            // 対象月の月初と月末を計算
            $targetMonth = (clone $currentDate)->modify("-{$i} months");
            $startOfMonth = (clone $targetMonth)->format('Y-m-01 00:00:00');
            $endOfMonth = (clone $targetMonth)->modify('last day of this month')->format('Y-m-d 23:59:59');

            // 月ごとの集計を取得
            $monthlyTopStage = Record::select('stage_id')
                ->selectRaw('COUNT(stage_id) as cnt')
                ->where('created_at', '>=', $startOfMonth)
                ->where('created_at', '<=', $endOfMonth)
                ->where('stage_id', '<', 1000)
                ->where('flg', '<', 2)
                ->groupBy('stage_id')
                ->orderBy('cnt', 'DESC')
                ->limit(1) // 月ごとの最多stage_idを1つ取得
                ->first();

            if ($monthlyTopStage) {
                $result[] = [
                    'month' => (clone $targetMonth)->format('Y年m月'),
                    'stage_id' => $monthlyTopStage->stage_id,
                    'cnt' => $monthlyTopStage->cnt,
                ];
            }
        }

        return response()->json($result);
    }
    public function getPrevTrendPost(): JsonResponse
    {
        // 現在の日時を取得
        $currentDate = new DateTime();

        // 年初の1月1日の日付を取得
        $startOfYear = (clone $currentDate)->modify('first day of January')->format('Y-m-01 00:00:00');

        // 年初から現在までのstage_id集計を取得
        $topStage = Record::select('stage_id')
            ->selectRaw('COUNT(stage_id) as cnt')
            ->where('created_at', '>=', $startOfYear) // 年初から現在までの範囲
            ->where('stage_id', '<', 1000)
            ->where('flg', '<', 2)
            ->groupBy('stage_id') // stage_idごとにグループ化
            ->orderBy('cnt', 'DESC') // カウントが多い順に並べる
            ->limit(1) // 最も多いstage_idを1つ取得
            ->first();

        // 年初から現在までのユニークユーザー数を取得
        $uniqueUserCount = Record::where('created_at', '>=', $startOfYear) // 年初から現在までの範囲
        ->where('stage_id', '<', 1000)
            ->where('flg', '<', 2)
            ->count('unique_id');

        // 結果を配列にまとめる
        $result = [
            'stage' => $topStage,
            'posts' => $uniqueUserCount,
        ];

        // 結果をJSONで返す
        return response()->json($result);
    }
}
