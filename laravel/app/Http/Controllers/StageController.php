<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\Record;
use App\Models\Stage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class StageController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        // 検索用にすべてのステージ情報を返す
        return response()->json(Stage::select('stage_id', 'stage_name', 'eng_stage_name', 'parent', 'type')->get());
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param \Illuminate\Http\Request $request
     * @return Response
     */
    public function store(Request $request)
    {
        //
    }
    /**
     * @return array
     */
    // すべてのステージの参加者数を取得
    public function allStageMember(): array
    {
        $records = Record::select('stage_id', 'user_id')->where('stage_id', '<', 10000)->where('flg', '<', 2)->get();
        return $records->groupBy('stage_id')->map(function($group){
            return count($group->pluck('user_id')->unique());
        })->all();
    }
    public function maxMember(): int
    {
        return max($this->allStageMember());
    }
    /**
     * Display the specified resource.
     *
     * @param $id
     * @return JsonResponse
     */
    public function show($id): JsonResponse
    {
        if($id < 100000) {

            // ５桁以下ならステージ情報データベースから取得
            $data = Stage::where('stage_id', $id)->first();

            $collect = Record::where('stage_id', $id)->where('flg', '<', 2);

            // 総投稿数
            $data["count"] = $collect->count();

            // 参加者数
            $data["member"] = $collect->groupBy("user_id")->get()->count();

        } else {

            // ６桁以上ならイベントデータベースから取得
            $data = Event::where('stage', $id)->first();
        }

        return response()->json(
            $data
        );
    }

    /**
     * Update the specified resource in storage.
     *
     * @param \Illuminate\Http\Request $request
     * @param int $id
     * @return Response
     */
    public function update(Request $request, $id)
    {
        //
    }
}
