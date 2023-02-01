<?php

namespace App\Http\Controllers;

use App\Models\Record;
use App\Models\Total;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class TotalController extends Controller
{

    public function __invoke(): string
    {
        // TODO: Implement __invoke() method.
        return "invoke";
    }
    /**
     * Display a listing of the resource.
     *
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        $data = Total::all();
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
        $data = new Total;

        $data->fill([
            'user_name' => $request['user_name'],
            'score' => $request['score']
        ]);

        $data->save();

        return response()->json([
            "message" => "created",
            "data" => $data
        ], 201);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param Request $request
     * @return void
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
        $stage_list = [
            201 => [
                201, 202, 203
            ],
            202 => [
                202, 204, 206
            ]
        ];
        $model = Record::whereIn('stage_id',$stage_list[$request['id']])->get();
        $datas = $model->toArray();
        $res   = array();

        // 対象の記録群からユニークなユーザー配列を作成し、値を初期化
        foreach($users = array_unique( array_column($datas, 'user_name') ) as $user){
            $res[$user]["user_name"] = $user;
            $res[$user]["score"] = 0;
            $res[$user]["rps"]   = 0;
            $res[$user]["count"] = 0;
            $res[$user]["ranks"] = array();
        }
        // ユーザー配列に各種データを入れ込む
        foreach($users as $user){
            foreach($datas as $data){
                if($user !== $data["user_name"]) {
                    continue;
                }
                $res[$user]["score"] += $data["score"];
                $res[$user]["rps"]   += $data["rps"];
                $res[$user]["count"] ++;
                $res[$user]["ranks"][] = $data["post_rank"];
            }
        }
        return response()->json(
            $res
        );
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param Total $Total
     * @return Response
     */
    public function edit(Total $Total)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     *
     * @param Request $request
     * @param Total $product
     * @return Response
     */
    public function update(Request $request, Total $product)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param Total $Total
     * @return Response
     */
    public function destroy(Total $Total)
    {
        //
    }
}
