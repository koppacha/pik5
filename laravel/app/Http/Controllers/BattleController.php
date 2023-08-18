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
        // 結果に基づいてレートを計算する
        $p1_rate = $request['1p_rate'] ?: 1500;
        $p2_rate = $request['2p_rate'] ?: 1500;

        $rating = new Rating($p1_rate, $p2_rate, Rating::LOST, Rating::WIN);
        $result = $rating->getNewRatings();

        $p1_rate = $result['a'];
        $p2_rate = $result['b'];

        try {
            $posts = new Battle();
            $posts->fill([
                'stage_id' => $request['stage_id'],
                'rule' => 34,
                'result' => 2, // 無効試合＝0、1P勝利＝1、2P勝利＝2、引き分け＝3
                '1p_user_id' => $request['1p_user_id'],
                '1p_conf' => $request['1p_conf'],
                '1p_score' => $request['1p_score'],
                '1p_rate' => $p1_rate,
                '2p_user_id' => $request['2p_user_id'],
                '2p_conf' => $request['2p_conf'],
                '2p_score' => $request['2p_score'],
                '2p_rate' => $p2_rate,
                'unique_id' => "301".sprintf('%06d',random_int(0, 999999)),
                'user_ip' => $request->ip(),
                'user_host' => $request->host(),
                'user_agent' => $request->header('User-Agent'),
                'img_url' => null,
                'video_url' => $request['video_url'] ?: "",
                'flag' => 0
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
