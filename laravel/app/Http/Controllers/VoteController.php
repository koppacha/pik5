<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreVoteRequest;
use App\Http\Requests\UpdateVoteRequest;
use App\Models\Vote;
use DateTime;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use function response;

class VoteController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        $vote = new Vote();
        $data = $vote->all();
        return response()->json(
            $data
        );
    }

    /**
     * Show the form for creating a new resource.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function create(Request $request): JsonResponse
    {
        try {
            $vote = new Vote();
            $date = new DateTime();

            // 第19回期間限定のチーム分けアルゴリズム
            if($request['vote'] === 20231216){

                // それぞれのチームの参加人数を数える
                foreach([21, 22] as $team) {
                    $counts[$team] = $vote
                        ->where("vote", "20231216")
                        ->where("select", $team)
                        ->where("flag", "<", 2)
                        ->groupBy('user')
                        ->get()
                        ->count();
                }
                // 一次抽選は完全ランダム
                $select = random_int(0, 1) ? 21 : 22;

                // チーム人数差が生じている場合は少ない方にアサイン
                if($counts[21] > $counts[22]){
                    $select = 22;
                }
                if($counts[22] > $counts[21]){
                    $select = 21;
                }
                // 過去３大会でMVPのユーザーは被らないようにする
                if($request['user'] === 'albut3') {
                    $select = 21;
                }
                if($request['user'] === 'gorei_50') {
                    $select = 22;
                }
            } else {
                $select = $request['select'];
            }

            $vote->fill([
                'user' => $request['user'] ?: "guest",  // 投票者名
                'vote' => $request['vote'] ?: "",       // 対象テーマ、イベント等
                'select' => $select ?: 0,               // 投票する内容（数値）
                'comment' => "",                        // コメント
                'flag' => $request['flag'] ?: 1,        // 削除フラグ
                'created_at' => $request['created_at'] ?: $date
            ]);
            $vote->save();

        } catch (Exception $e) {
            return response()->json(["ERROR:$e", 500]);
        }
        return response()->json(
            ["OK", 200]
        );
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  \App\Http\Requests\StoreVoteRequest  $request
     * @return \Illuminate\Http\Response
     */
    public function store(StoreVoteRequest $request)
    {
        //
    }

    /**
     * Display the specified resource.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function show(Request $request): JsonResponse
    {
        $vote = new Vote();
        $data = $vote->where("vote", $request["vote"])->where("flag", "<", 2)->get();
        return response()->json(
            $data
        );
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param Vote $vote
     * @return \Illuminate\Http\Response
     */
    public function edit(Vote $vote)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \App\Http\Requests\UpdateVoteRequest  $request
     * @param Vote $vote
     * @return \Illuminate\Http\Response
     */
    public function update(UpdateVoteRequest $request, Vote $vote)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param Vote $vote
     * @return \Illuminate\Http\Response
     */
    public function destroy(Vote $vote)
    {
        //
    }
}
