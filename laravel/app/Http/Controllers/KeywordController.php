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
use Illuminate\Support\Str;
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
            // 1) URLエンコード（マルチバイト含む）されたIDを安全にデコード
            $decodedId = rawurldecode($id);

            // 特別モード: recent（重複キーワードを排除し、更新日の新しい順で最大20件）
            if (strtolower($decodedId) === 'recent') {
                $recentItems = Keyword::orderByDesc('updated_at')
                    ->limit(500) // 重複排除後に十分数が残るようバッファ
                    ->get()
                    ->unique('keyword')
                    ->take(20)
                    ->values();

                return response()->json([
                    'mode'  => 'recent',
                    'items' => $recentItems,
                ], 200);
            }

            // 2) 親候補（子記事集合）: tag が一致する行を取得（並びは後段で再ソートするためDB順序は未指定）
            $children = Keyword::where('tag', $decodedId)->get();

            // 3) 親行（単一）: keyword が一致する最新更新の行
            $parentRow = Keyword::where('keyword', $decodedId)
                ->orderByDesc('updated_at')
                ->first();

            // --- 子記事の並び替えロジック ---------------------------------------
            // 並び替え規則：
            //  - 本文が `<!--` で始まる場合のみ、最初の `<!--` ～ 次の `-->` をメタとして解析（内部の前後空白はtrim）
            //  - メタが数値/日付（メタ番号）：降順。等しい場合は updated_at 降順
            //  - メタが文字列（メタ文字）：昇順（小文字化して比較）。等しい場合は updated_at 降順
            //  - 混在時の型優先：番号 → 文字 → コメントなし
            //
            // 注意：
            //  - 日付は yyyymmddhhMMss の14桁数値に正規化し、数値と同一比較軸で扱う
            //  - 指数表記やマイナスは数値として扱う
            //  - `<!--` が先頭以外にある or `-->` が無い場合は「コメントなし」

            // 型のランク付け：番号(0) < 文字(1) < なし(2)
            $TYPE_NUMBER = 0;
            $TYPE_STRING = 1;
            $TYPE_NONE   = 2;

            // 数値判定（マイナス・指数を許容）
            $isNumericExtended = function (string $s): bool {
                // 前後空白除去
                $t = trim($s);
                // PHPの数値表現（+/-、小数、指数）を広く許容
                // 先頭+はfloatvalが解釈できるが、ここでは許容
                return preg_match('/^[\+\-]?(?:\d+\.?\d*|\.\d+)(?:[eE][\+\-]?\d+)?$/', $t) === 1;
            };

            // 日付らしさ判定（YYYY[-/]MM[-/]DD( [T]?hh[:MM][:ss]?) あるいは区切り無しYYYYMMDD[hhMMss]）
            $isDateLike = static function (string $s): bool {
                $t = trim($s);
                // 素直なISO/一般的な区切りあり
                if (preg_match('/^\d{4}([\-\/]?\d{2}){1,2}([ T]\d{2}:\d{2}(:\d{2})?)?(?:Z)?$/', $t)) {
                    return true;
                }
                // 区切りなし 例: 20250101123456 or 20250101
                if (preg_match('/^\d{8}(\d{6})?$/', $t)) {
                    return true;
                }
                // ISO拡張 例: 2025-01-01T12:34:56Z
                if (preg_match('/^\d{4}\-\d{2}\-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[\+\-]\d{2}:\d{2})?$/', $t)) {
                    return true;
                }
                return false;
            };

            // 日付→数値(yyyymmddhhMMss)に正規化（不足は0埋め、余分は先頭14桁を採用、秒未満は無視）
            $dateToNumeric14 = static function (string $s): int {
                $t = trim($s);

                // 1) 区切りや記号を除去しつつ、数字のみ抽出
                //    ISOの 'T' や 'Z'、'-', '/', ':', '.', '+' などを無視
                $digits = preg_replace('/\D+/', '', $t) ?? '';

                // 2) 8桁（YYYYMMDD）しか無い場合は時分秒を 000000 で補完
                if (strlen($digits) === 8) {
                    $digits .= '000000';
                }

                // 3) 長さが14未満なら末尾0埋め、14超なら先頭から14桁を使用
                if (strlen($digits) < 14) {
                    $digits = str_pad($digits, 14, '0', STR_PAD_RIGHT);
                } elseif (strlen($digits) > 14) {
                    $digits = substr($digits, 0, 14);
                }

                // 4) 整数化（先頭に0があり得るが、数値比較用にintへ）
                //    桁が大きくintを超える場合があるため、PHP_INT_MAXを超える環境では文字列比較も検討
                //    ここでは文字列比較回避のため、bcmathが無い前提で安全に扱えるよう、数値として扱うが
                //    極端に大きいケースは想定外（14桁はint範囲内）とする
                return (int)$digits;
            };

            // メタ抽出（先頭が `<!--` のとき、最初の `<!--` ～ 次の `-->` を取り出しtrim）
            $extractMeta = static function (?string $content): ?string {
                if (!is_string($content)) {
                    return null;
                }
                if (!Str::startsWith($content, '<!--')) {
                    return null;
                }

                $start = strpos($content, '<!--'); // 仕様上ここは0のはず
                $end   = strpos($content, '-->', $start + 4);
                if ($start !== 0 || $end === false) {
                    return null;
                }

                $inner = substr($content, $start + 4, $end - ($start + 4));
                return trim($inner ?? '');
            };

            // 子記事に型と比較値を付与してからソート
            if ($children->isNotEmpty()) {
                $enriched = $children->map(function ($row) use (
                    $TYPE_NUMBER, $TYPE_STRING, $TYPE_NONE,
                    $extractMeta, $isNumericExtended, $isDateLike, $dateToNumeric14
                ) {
                    $meta = $extractMeta($row->content ?? null);

                    if ($meta === null) {
                        // コメントなし
                        return [
                            'type_rank' => $TYPE_NONE,
                            'key'       => null, // 比較値なし
                            'row'       => $row,
                        ];
                    }

                    // メタ番号（数値 or 日付）
                    if ($isDateLike($meta)) {
                        return [
                            'type_rank' => $TYPE_NUMBER,
                            'key'       => $dateToNumeric14($meta), // 大きい順
                            'row'       => $row,
                        ];
                    }

                    if ($isNumericExtended($meta)) {
                        // 指数やマイナスも許容
                        return [
                            'type_rank' => $TYPE_NUMBER,
                            'key'       => (float)$meta, // 大きい順
                            'row'       => $row,
                        ];
                    }

                    // メタ文字（小文字化して昇順）
                    $normalized = mb_strtolower($meta, 'UTF-8');
                    return [
                        'type_rank' => $TYPE_STRING,
                        'key'       => $normalized,
                        'row'       => $row,
                    ];
                })->all();

                // 安定比較関数
                usort($enriched, static function ($a, $b) use ($TYPE_NUMBER, $TYPE_STRING, $TYPE_NONE) {
                    // 1) 型ランク：番号(0) → 文字(1) → なし(2)
                    if ($a['type_rank'] !== $b['type_rank']) {
                        return $a['type_rank'] <=> $b['type_rank'];
                    }

                    // 2) 同型内の比較
                    //    - 番号: key 降順
                    //    - 文字: key 昇順
                    //    - なし: key 無し（次のupdated_at比較へ）
                    if ($a['type_rank'] === $TYPE_NUMBER) {
                        if ($a['key'] !== $b['key']) {
                            // 降順
                            return ($a['key'] < $b['key']) ? 1 : -1;
                        }
                    } elseif ($a['type_rank'] === $TYPE_STRING) {
                        if ($a['key'] !== $b['key']) {
                            // 昇順（文字列比較）
                            return $a['key'] <=> $b['key'];
                        }
                    }

                    // 3) タイブレーク：updated_at の新しい順（降順）
                    $au = strtotime((string)$a['row']->updated_at);
                    $bu = strtotime((string)$b['row']->updated_at);
                    if ($au !== $bu) {
                        return ($au < $bu) ? 1 : -1; // 新しい方が先
                    }

                    // 4) 最終タイブレーク：id昇順（安定化）
                    return ($a['row']->id ?? 0) <=> ($b['row']->id ?? 0);
                });

                // 元のコレクションに並び替えを反映
                $children = collect($enriched)->map(fn($x) => $x['row'])->values();
            }
            // -------------------------------------------------------------------

            if ($children->isNotEmpty()) {
                return response()->json([
                    'mode'     => 'parent',
                    'parent'   => $parentRow,  // keyword==id の単一親（存在しない場合はnull）
                    'children' => $children,   // tag==id の全行（メタ規則で並び替え済み）
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
