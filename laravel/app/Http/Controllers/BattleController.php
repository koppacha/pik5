<?php

namespace App\Http\Controllers;

use App\Models\Battle;
use Chovanec\Rating\Rating;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
     * Show the form for creating a new resource.
     *
     * @return JsonResponse
     */
    public function create(Request $request): JsonResponse
    {
        // 結果に基づいてレート計算する
        // TODO: データがここに来た段階ではプレイヤーごとに行を分割しない方がいいかも
        // TODO: プレイヤー数が不定なのでカラムが一定にならない問題

        try {
            $posts = new Battle();
            $posts->fill([
                'stage_id' => null,
                'battle_id' => null,
                'player' => null,
                'rule' => 34,
                'point' => null,
                'result_point' => null,
                'rank' => null,
                'pikmin' => null,
                'user_id' => null,
                'dandori_pts' => null,
                'com_dandori_pts' => null,
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
