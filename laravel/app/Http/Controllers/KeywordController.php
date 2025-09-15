<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreKeywordRequest;
use App\Http\Requests\UpdateKeywordRequest;
use App\Models\Keyword;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

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
            if(isset($request->c) && $request->c !== "" && $request->c !== "all" && $data["category"] !== $request->c) {
                continue;
            }
            if(isset($request->t) && $request->t !== "" && $data["tag"] !== $request->t) {
                continue;
            }
            $filtered_dataset[] = $data;
            $unique_ids[] = $data["unique_id"];
        }

        // 並び変えの基準
        $sort_key = array_column($filtered_dataset, 'tag');
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
//        logger($request->all());
        try {
            // Collect inputs with existing defaults (keep original behavior)
            $input = [
                'unique_id'    => $request->input('unique_id'),
                'stage_id'     => $request->input('stage_id', 0),
                'adopted'      => 0,
                'keyword'      => $request->input('keyword'),
                'category'     => $request->input('category', 'other'),
                'tag'          => $request->input('tag', 'その他'),
                'yomi'         => $request->input('yomi', ''),
                'content'      => $request->input('content'),
                'first_editor' => $request->input('first_editor', 'guest'),
                'last_editor'  => $request->input('last_editor', 'guest'),
                'flag'         => $request->input('flag', 1),
            ];

            // Validation (non-breaking, mirrors current expectations)
            $validator = Validator::make($input, [
                'unique_id'    => ['nullable','regex:/^[0-9a-fA-F]{1,13}$/'],
                'stage_id'     => ['integer','min:0'],
                'adopted'      => ['integer','in:0,1'],
                'keyword'      => ['required','string','max:255'],
                'category'     => ['required','string','max:64'],
                'tag'          => ['nullable','string','max:64'],
                'yomi'         => ['nullable','string','max:255'],
                'content'      => ['required','string'],
                'first_editor' => ['required','string','max:64'],
                'last_editor'  => ['required','string','max:64'],
                'flag'         => ['integer'],
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'validation error',
                    'errors'  => $validator->errors(),
                ], 422);
            }

            $keywords = new Keyword();
            $keywords->fill([
                'unique_id'    => $input['unique_id'] ?: $this->uniqueIdReal(),
                'stage_id'     => $input['stage_id'],
                'adopted'      => $input['adopted'],
                'keyword'      => $input['keyword'],
                'category'     => $input['category'],
                'tag'          => $input['tag'],
                'yomi'         => $input['yomi'],
                'content'      => $input['content'],
                'first_editor' => $input['first_editor'],
                'last_editor'  => $input['last_editor'],
                'flag'         => $input['flag'],
            ]);
            $keywords->save();

        } catch (Exception $e) {
            $array = $request->all();
            return response()->json([
                'REQUEST: ' . implode(', ', $array),
                'ERROR: ' . $e,
                500
            ]);
        }
        return response()->json([
            'OK',
            200
        ]);
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
            throw new \RuntimeException("no cryptographically secure random function available");
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
        try {
            $data = Keyword::where('unique_id', $request['id'])->latest()->first();
            return response()->json(
                $data
            );
        } catch (Exception $e){
            Log::debug("Keyword:show:error", [$e]);
            return response()->json(
                ["server error"]
            );
        }
    }
    public function resolve(Request $request, string $id): JsonResponse
    {
        try {
            // 1) Decode URL-encoded (including multibyte) ID safely
            $decodedId = rawurldecode($id);

            // Special case: recent keywords (dedup by keyword, latest updated first)
            if (strtolower($decodedId) === 'recent') {
                // Fetch a buffer of latest records, then unique by `keyword` and take top 20
                $recentItems = Keyword::orderByDesc('updated_at')
                    ->limit(500)  // buffer to ensure we can dedup and still have 20
                    ->get()
                    ->unique('keyword')
                    ->take(20)
                    ->values();

                return response()->json([
                    'mode'  => 'recent',
                    'items' => $recentItems,
                ], 200);
            }

            // 2) Find parent candidates by `tag`
            $parentCandidates = Keyword::where('tag', $decodedId)
                ->orderByDesc('created_at')
                ->get();

            // 3) Find the parent row (single) by `keyword` (used as the main/parent article)
            $parentRow = Keyword::where('keyword', $decodedId)
                ->orderByDesc('updated_at')
                ->first();

            if ($parentCandidates->isNotEmpty()) {
                return response()->json([
                    'mode'     => 'parent',
                    'parent'   => $parentRow,        // may be null if there isn't a single parent row with keyword == id
                    'children' => $parentCandidates, // all rows whose tag == id
                ], 200);
            }

            if ($parentRow) {
                return response()->json([
                    'mode'     => 'unique',
                    'parent'   => $parentRow,
                    'children' => [],
                ], 200);
            }

            return response()->json(['mode' => 'notfound'], 404);
        } catch (Throwable $e) {
            Log::error('Keyword:resolve:error', ['id' => $id, 'e' => $e->getMessage()]);
            return response()->json(['message' => 'server error'], 500);
        }
    }
    /**
     * Upload an image for keyword content.
     *
     * Expects multipart/form-data with field name 'image'.
     * Saves the file under storage/app/public/keyword/<13hex>.<ext>
     * Returns JSON: { image_id: "<13hex>.<ext>", url: "/storage/keyword/<13hex>.<ext>" }
     */
    public function uploadImage(Request $request): JsonResponse
    {
        try {
            if (!$request->hasFile('image')) {
                return response()->json(['message' => 'ファイルがありません'], 422);
            }

            $file = $request->file('image');
            if (!$file->isValid()) {
                return response()->json(['message' => '無効なファイルです'], 422);
            }

            // Validate extension
            $ext = strtolower($file->getClientOriginalExtension());
            $allow = ['jpg','jpeg','png','gif','webp','avif'];
            if (!in_array($ext, $allow, true)) {
                return response()->json(['message' => '許可されていない拡張子です'], 422);
            }

            // Generate 13 hex digits ID (52-bit space)
            $id = substr(bin2hex(random_bytes(7)), 0, 13);
            $filename = $id . '.' . $ext;

            // Store to public disk under keyword/
            $path = $file->storeAs('public/keyword', $filename);
            if (!$path) {
                return response()->json(['message' => '保存に失敗しました'], 500);
            }

            return response()->json([
                'image_id' => $filename,
                'url'      => Storage::url('keyword/' . $filename),
            ], 201);
        } catch (Throwable $e) {
            Log::error('Keyword:uploadImage:error', [
                'msg' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'server error'], 500);
        }
    }
    /**
     * Return tag stats: distinct tag names (non-empty) with article counts, sorted by count desc.
     * Results are cached for 1 day to avoid frequent DB hits.
     */
    public function tagStats(Request $request): JsonResponse
    {
        try {
            $ttlSeconds = 60 * 60 * 24; // 1 day
            $data = Cache::remember('keyword_tag_stats_v1', $ttlSeconds, static function () {
                // Use aggregation in SQL: exclude NULL/empty/whitespace-only tags
                $rows = Keyword::select([
                        'tag',
                        DB::raw('COUNT(*) as count')
                    ])
                    ->whereNotNull('tag')
                    ->whereRaw("TRIM(tag) <> ''")
                    ->groupBy('tag')
                    ->orderByDesc('count')
                    ->get();

                // Normalize structure
                return $rows->map(function ($row) {
                    return [
                        'tag' => $row->tag,
                        'count' => (int) $row->count,
                    ];
                })->values();
            });

            return response()->json($data, 200);
        } catch (Throwable $e) {
            Log::error('Keyword:tagStats:error', ['e' => $e->getMessage()]);
            return response()->json(['message' => 'server error'], 500);
        }
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
