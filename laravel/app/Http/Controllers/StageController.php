<?php

namespace App\Http\Controllers;

use App\Models\Event;
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
     * Display the specified resource.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function show(Request $request): JsonResponse
    {
        if($request['id'] < 100000) {

            // ５桁以下ならステージ情報データベースから取得
            $data = Stage::where('stage_id', $request['id'])->first();

        } else {

            // ６桁以上ならイベントデータベースから取得
            $data = Event::where('stage', $request['id'])->first();
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
