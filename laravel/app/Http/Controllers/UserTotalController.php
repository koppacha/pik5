<?php

namespace App\Http\Controllers;

use App\Models\Record;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class UserTotalController extends Controller
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
     * @param Request $request
     * @return array
     */
    public function show(Request $request): array
    {
        // 当該ユーザーの通常ランキング全記録をリクエスト
        $dataset = Record::where("user_id", $request['id'])
            ->where('flg','<', 2)
            ->orderBy('created_at', 'DESC')
            ->get();

        // 配列型に変換
        $dataset->toArray();

        $filter = []; // 重複削除するためのフィルター
        $data = [
            10 => [0, 0, 0],
            11 => [0, 0, 0],
            20 => [0, 0, 0],
            21 => [0, 0, 0],
            22 => [0, 0, 0],
            23 => [0, 0, 0],
            24 => [0, 0, 0],
            25 => [0, 0, 0],
            26 => [0, 0, 0],
            27 => [0, 0, 0],
            28 => [0, 0, 0],
            29 => [0, 0, 0],
            30 => [0, 0, 0, 0, 0, 0, 0],
            31 => [0, 0, 0, 0, 0, 0, 0],
            32 => [0, 0, 0, 0, 0, 0, 0],
            33 => [0, 0, 0, 0, 0, 0, 0],
            34 => [0, 0, 0, 0, 0, 0, 0],
            35 => [0, 0, 0, 0, 0, 0, 0],
            36 => [0, 0, 0, 0, 0, 0, 0],
            40 => [0, 0, 0, 0, 0, 0, 0],
            91 => [0, 0, 0],
            92 => [0, 0, 0],
            93 => [0, 0, 0],
            94 => [0, 0, 0],
            99 => [0, 0, 0],
        ];

        // 最新記録のみループを回して各配列にスコアを加算していく
        foreach($dataset as $value){
            if(in_array($value["stage_id"].$value["console"].$value["rule"], $filter, true)){
                continue;
            }
            $filter[] = $value["stage_id"].$value["console"].$value["rule"];
            $data[$value["rule"]][$value["console"]] += $value["score"];
        }
        return $data;
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function destroy($id)
    {
        //
    }
}
