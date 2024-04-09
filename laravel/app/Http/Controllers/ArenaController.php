<?php

namespace App\Http\Controllers;

use App\Models\Arena;
use App\Models\Record;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArenaController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        // 有効なレコードをすべて返す
        return response()->json(Arena::where('del', 0)->get());
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param Request $request
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     *
     * @param Arena $arena
     * @return \Illuminate\Http\Response
     */
    public function show(Arena $arena)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param Arena $arena
     * @return \Illuminate\Http\Response
     */
    public function edit(Arena $arena)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     *
     * @param Request $request
     * @param Arena $arena
     * @return JsonResponse|void
     */
    public function update(Request $request, Arena $arena)
    {
        // /api/arena/update/{team}/{stage?}/{time?}
        $arenas = new Arena();
        $team = $request["team"];

        if($team === 1 || $team === 2) {
            return response()->json(["error", "Incorrect team number."]);
        }
        if(!empty($request["stage"]) && $request["stage"] > 1299){
            // 次へボタンを押したときの前処理
            $records = new Record();
            $recordCount = $records->where('stage_id', $request["stage"])->count();
            $arenaRecord = $arenas->where('stage', $request["stage"])->first();
            if($arenaRecord) {
                $arenaRecord->flag = ($recordCount) ? $team + 2 : 9;
                $arenaRecord->save();
            }
        }
        // 次のステージを抽選する処理
        $getRandomStage = $arenas->where('flag', $team + 2)->orderBy('updated_at', 'desc')->first();

        if(!$getRandomStage) {
            $getRandomStage = $arenas->where('flag', 0)->inRandomOrder()->first();
        }
        if($getRandomStage){
            $getRandomStage->flag = $team;
            $getRandomStage->save();
        }
        return response()->json($getRandomStage);
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param Arena $arena
     * @return \Illuminate\Http\Response
     */
    public function destroy(Arena $arena)
    {
        //
    }
}
