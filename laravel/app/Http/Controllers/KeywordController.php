<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreKeywordRequest;
use App\Http\Requests\UpdateKeywordRequest;
use App\Models\Keyword;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class KeywordController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        $dataset = Keyword::latest()->get();

        $keywords = [];
        $filtered_dataset = [];
        foreach($dataset as $data){
            if(in_array($data["keyword"], $keywords, true)){
                continue;
            }
            $filtered_dataset[] = $data;
            $keywords[] = $data["keyword"];
        }

        return response()->json(
            $filtered_dataset
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
        Keyword::create([
            'keyword' => $request['keyword'],
            'yomi' => $request['yomi'],
            'content' => $request['content'],
            'created_at' => $request['created_at']
        ]);
        return response()->json(
            ["OK", 200]
        );
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  \App\Http\Requests\StoreKeywordRequest  $request
     * @return Response
     */
    public function store(StoreKeywordRequest $request)
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
        $data = Keyword::where('id', $request['id'])->get();
        return response()->json(
            $data[0]
        );
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  \App\Models\Keyword  $keyword
     * @return Response
     */
    public function edit(Keyword $keyword)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \App\Http\Requests\UpdateKeywordRequest  $request
     * @param  \App\Models\Keyword  $keyword
     * @return Response
     */
    public function update(UpdateKeywordRequest $request, Keyword $keyword)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  \App\Models\Keyword  $keyword
     * @return Response
     */
    public function destroy(Keyword $keyword)
    {
        //
    }
}
