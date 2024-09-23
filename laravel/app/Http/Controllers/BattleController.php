<?php

namespace App\Http\Controllers;

use App\Models\Battle;
use Chovanec\Rating\Rating;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class BattleController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index()
    {
        //
    }
    /**
     * すべてのステージの大会記録を取得する
     *
     * @return JsonResponse
     */
    public function getScore(): JsonResponse
    {
        $battles = new Battle();
        $result = $battles->select('user_id', 'stage_id', 'pikmin', 'dandori_pts', 'com_dandori_pts', 'com_dandori_pts', 'com_dandori_pts', 'created_at',
        DB::raw('dandori_pts - com_dandori_pts as dandori_score'))
            ->orderBy('stage_id')
            ->orderBy('pikmin')
            ->orderBy('dandori_score', 'desc')
            ->orderBy('created_at', 'asc')
            ->get()
            ->toArray();

        $check = [];
        $data = [];
        foreach($result as $item) {
            $check_str = $item["stage_id"]."-".$item["pikmin"];
            if(in_array($check_str, $check, true)){
                continue;
            }
            $check[] = $check_str;
            $data[] = $item;
        }

        return response()->json($data);
    }

    /**
     * すべてのユーザーの最終レートを含むリザルトを取得する
     *
     * @return JsonResponse
     */
    public function getRate(): JsonResponse
    {
        $battles = new Battle();
        $result = $battles->orderBy('session_id', 'desc')->orderBy('battle_id', 'desc')->get();
        $result = $result->unique('user_id');

        return response()->json($result);
    }

    /**
     * Show the form for creating a new resource.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function create(Request $request): JsonResponse
    {
        // 結果に基づいてレート計算する
        try {
            $posts = new Battle();
            $posts->fill([
                'id' => "309".sprintf('%06d',random_int(0, 999999)),
                'session_id' => $request["session_id"],
                'stage_id' => $request["stage_id"],
                'battle_id' => $request["battle_id"],
                'player' => $request["player"],
                'rule' => $request["rule"],
                'point' => $request["point"],
                'result_point' => $request["result_point"],
                'rank' => $request["rank"],
                'pikmin' => $request["pikmin"],
                'user_id' => $request["user_id"],
                'dandori_pts' => $request["dandori_pts"],
                'com_dandori_pts' => $request["com_dandori_pts"],
                'flg' => 0,
            ]);
            $posts->save();

        } catch (Exception $e) {
            return response()->json($e);
        }
        return response()->json(
            ["OK", 200]
        );
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     *
     * @param  \App\Models\Battle  $battle
     * @return \Illuminate\Http\Response
     */
    public function show(Battle $battle)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  \App\Models\Battle  $battle
     * @return \Illuminate\Http\Response
     */
    public function edit(Battle $battle)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\Battle  $battle
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, Battle $battle)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  \App\Models\Battle  $battle
     * @return \Illuminate\Http\Response
     */
    public function destroy(Battle $battle)
    {
        //
    }
}
