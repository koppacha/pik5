<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreKeywordRequest;
use App\Http\Requests\UpdateKeywordRequest;
use App\Models\Keyword;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class KeywordController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $dataset = Keyword::latest()->get();
        $unique_ids = [];
        $filtered_dataset = [];
        foreach($dataset as $data){
            if(in_array($data["unique_id"], $unique_ids, true)){
                continue;
            }
            if(isset($request->c) && $request->c !== "" && $request->c !== "all"){
                if($data["category"] !== $request->c){
                    continue;
                }
            }
            if(isset($request->t) && $request->t !== "") {
                if ($data["tag"] !== $request->t) {
                    continue;
                }
            }
            $filtered_dataset[] = $data;
            $unique_ids[] = $data["unique_id"];
        }

        // 並び変えの基準
        $sort_key = array_column($filtered_dataset, 'yomi');
        array_multisort($sort_key, SORT_STRING, $filtered_dataset);

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
        try {
            $keywords = new Keyword();
            $keywords->fill([
                    'unique_id' => $request['unique_id'] ?: $this->uniqueIdReal(),
                    'keyword' => $request['keyword'],
                    'category' => $request['category'],
                    'tag' => $request['tag'] ?: "その他",
                    'yomi' => $request['yomi'],
                    'content' => $request['content'],
                    'first_editor' => $request['first_editor'],
                    'last_editor' => $request['last_editor'],
                    'created_at' => $request['created_at'],
                    'flag' => $request['flag'] ?: 1,
                ]);
            $keywords->save();

        } catch (\Exception $e) {
            return \response()->json(["ERROR:$e", 500]);
        }
        return response()->json(
            ["OK", 200]
        );
    }

    /**
     * @throws Exception
     */
    private function uniqueIdReal(): string
    {
        if (function_exists("random_bytes")) {
            $bytes = random_bytes(ceil(13 / 2));
        } elseif (function_exists("openssl_random_pseudo_bytes")) {
            $bytes = openssl_random_pseudo_bytes(ceil(13 / 2));
        } else {
            throw new Exception("no cryptographically secure random function available");
        }
        return substr(bin2hex($bytes), 0, 13);
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
        $data = Keyword::where('unique_id', $request['id'])->latest()->first();
        return response()->json(
            $data
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
