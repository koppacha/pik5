<?php

namespace App\Http\Controllers;

use App\Library\Func;
use App\Models\Record;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class NewRecordController extends Controller
{
    public function get(Request $request): JsonResponse
    {
        // 各コントローラーを読み込む
        $RecordController = new RecordController();
        $StageController = new StageController();
        $Func = new Func();

        $afterPostId = max((int)($request->query('after_post_id') ?: 0), 0);
        $limit = max((int)($request->query('limit') ?: 50), 1);
        $limit = min($limit, 200);

        // 記録をリクエスト
        $query = Record::publiclyVisible()
            ->leftJoin('users', 'records.user_id', '=', 'users.user_id')
            ->leftJoin('stages', 'records.stage_id', '=', 'stages.stage_id')
            ->select(array_merge(
                array_map(static fn ($column) => 'records.' . $column, config('const.selected')),
                ['users.user_name as user_name', 'stages.stage_name as stage_name', 'stages.display as stage_display']
            ))
            ->where('records.stage_id', "<", 10000)
            ->where('records.flg','<', 2)
            ->when($afterPostId > 0, static function ($builder) use ($afterPostId) {
                return $builder->where('records.post_id', '>', $afterPostId);
            });

        if ($afterPostId > 0) {
            $dataset = $query
                ->orderBy('records.post_id', 'ASC')
                ->limit($limit)
                ->get()
                ->toArray();
        } else {
            $dataset = $query
                ->orderBy('records.created_at', 'DESC')
                ->limit($limit)
                ->get()
                ->toArray();
        }

        // Event card names belong to the linked card, rather than the event category rule.
        $eventCards = DB::table('trick_event_records as links')
            ->join('decks', 'decks.id', '=', 'links.deck_id')
            ->leftJoin('stages as origins', 'origins.stage_id', '=', 'decks.origin_stage_id')
            ->whereIn('links.record_id', array_column($dataset, 'post_id'))
            ->get(['links.record_id', 'decks.origin_stage_id', 'decks.rule_name', 'origins.stage_name'])
            ->keyBy('record_id');
        foreach ($dataset as &$row) {
            // Score can render event records without one extra request per stage.
            if ((int) $row['stage_id'] >= 1001 && (int) $row['stage_id'] <= 1999) {
                $row['score_type'] = $row['stage_display'] === 'time' ? 'time' : 'points';
            }
            unset($row['stage_display']);
            $card = $eventCards->get($row['post_id']);
            if ($card !== null) {
                $row['event_origin_stage_id'] = $card->origin_stage_id;
                $row['event_stage_name'] = $card->stage_name;
                $row['event_rule_name'] = $card->rule_name;
            }
        }
        unset($row);

        // 最大参加者数を取得
        $max = $StageController->maxMember();

        // 参加者数を一括取得
        $stageIds = array_column($dataset, 'stage_id');
        $membersByStage = Record::publiclyVisible()->whereIn('stage_id', $stageIds)
            ->where('flg','<',2)
            ->selectRaw('stage_id, COUNT(DISTINCT user_id) AS member')
            ->groupBy('stage_id')
            ->pluck('member','stage_id');

        // ループ内は rank と rps 計算だけ
        $out = [];
        foreach ($dataset as $row) {
            $rank = $RecordController->getRankArray($row, false);
            $member = $membersByStage[$row['stage_id']] ?? 0;
            $row['post_rank'] = $rank;
            $row['rps'] = $Func::rankPoint_calc($row['stage_id'], $rank, $member, $max);
            $row['user_name'] = $row['user_name'] ?: "";
            $out[] = $row;
        }

        return response()->json($out);
    }
}
