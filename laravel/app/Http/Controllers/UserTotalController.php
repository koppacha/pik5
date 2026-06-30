<?php

namespace App\Http\Controllers;

use App\Library\Func;
use App\Models\Record;
use App\Models\Total;
use App\Models\TotalSnapshot;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class UserTotalController extends Controller
{
    private const CONSOLE_CATEGORY_RULES = [10, 20, 30];
    private const RECOMMEND_RULES = [10, 11, 21, 22, 23, 24, 25, 29, 31, 32, 33, 35, 36, 41, 42, 43, 44, 45, 46, 47];
    private const NORMAL_RECOMMEND_RULES = [10, 21, 22, 31, 32, 33, 36, 41, 42, 43];
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
     * @return JsonResponse
     */
    public function show(Request $request): JsonResponse
    {
        $result = [
            "totals" => [
                "score" => 0,
                "rps" => 0,
                "mark" => 0,
            ],
        ];

        // 該当ユーザーの全総合ランキングデータをリクエスト
        $req = new Request(['id' => 1, 'rule' => 1, 'console' => 0, 'year' => date('Y')]);
        $totalController = new TotalController();
        $totals = $totalController->getTotals($req);

        $records = array_filter($totals, static function ($item) use ($request) {
            return $item['user_id'] === $request['id'];
        });
        if($records) {
            // インデックスをリセットする
            $records = array_values($records)[0];

            // 各ルールごとにスコアを足し合わせる
            $records["scores"] = $this->aggregateScores($records["ranks"]);
            $records["rps"] = $this->aggregateScores($records["ranks"], "rps");

            // 投稿数をカウント
            foreach ($records["ranks"] as $value){
                if(!isset($records["marks"][$value["rule"]])){
                    $records["marks"][$value["rule"]] = 0;
                }
                $records["marks"][$value["rule"]]++;

                if($value["rule"] === 21 || $value["rule"] === 22){
                    if(!isset($records["marks"]["20"])){
                        $records["marks"]["20"] = 0;
                    }
                    $records["marks"]["20"]++;
                }
                if($value["rule"] === 31 || $value["rule"] === 32 || $value["rule"] === 33 || $value["rule"] === 36){
                    if(!isset($records["marks"]["30"])){
                        $records["marks"]["30"] = 0;
                    }
                    $records["marks"]["30"]++;
                }
                if($value["rule"] === 41 || $value["rule"] === 42 || $value["rule"] === 43){
                    if(!isset($records["marks"]["40"])){
                        $records["marks"]["40"] = 0;
                    }
                    $records["marks"]["40"]++;
                }
            }
            // 最終的に返す配列
            $result = $records;

            // 各キーの合計値を取得（あらかじめ２総合と３総合を配列から除外
            unset($records["scores"][20], $records["scores"][30], $records["scores"][40],
                  $records["rps"][20], $records["rps"][30], $records["rps"][40],
                  $records["marks"][20], $records["marks"][30], $records["marks"][40]);

            $result["totals"]["score"] = array_sum($records["scores"]);
            $result["totals"]["rps"] = array_sum($records["rps"]);
            $result["totals"]["mark"] = array_sum($records["marks"]);

            // ここまでの計算結果をデータベースへ書き込む
            $this->updateTotalsTable($request['id'], $result, 0);
            $result["categoryRanks"] = $this->getCategoryRanks($request['id'], array_keys($result["scores"] ?? []));
            $result["consoleScores"] = $this->getConsoleCategoryScores($request['id']);
        }
        return response()->json(
            $result
        );
    }
    public function updateTotalsTable(string $userName, array $data, int $console = 0): void
    {
        $now = now(); // 現在時刻を取得
        $scores = $data['scores'];
        $rps = $data['rps'];
        $totals = $data['totals'];

        // 数値のサニタイズ（非数/無限/想定外の巨大値を除去して上限で丸める）
        $sanitizeInt = static function ($value, string $label, int $max = 9999999): int {
            $f = is_numeric($value) ? (float)$value : 0.0;
            if (is_infinite($f) || is_nan($f)) {
                Log::warning('UserTotalController sanitize: non-finite value', ['label' => $label, 'value' => $value]);
                $f = 0.0;
            }
            if ($f > $max) {
                Log::warning('UserTotalController sanitize: value clamped (too large)', ['label' => $label, 'value' => $value, 'max' => $max]);
                $f = (float)$max;
            }
            if ($f < 0) {
                $f = 0.0;
            }
            return (int) round($f);
        };

        foreach ($scores as $ruleId => $score) {
            if (!isset($rps[$ruleId])) {
                continue; // 対応するrpsがない場合はスキップ
            }

            $scoreVal = $sanitizeInt($score, "score[$ruleId]");
            $rpsVal   = $sanitizeInt($rps[$ruleId], "rps[$ruleId]");

            // ルール別スコア
            DB::table('totals')->updateOrInsert(
                ['user' => $userName, 'rule' => $ruleId, 'console' => $console],
                [
                    'score' => $scoreVal,
                    'rps' => $rpsVal,
                    'flg' => 0,
                    'updated_at' => $now,
                ]
            );

            // 合計スコア（都度同じ値を書き直すが問題なし）
            $totScore = $sanitizeInt($totals['score'] ?? 0, 'totals.score');
            $totRps   = $sanitizeInt($totals['rps'] ?? 0, 'totals.rps');
            DB::table('totals')->updateOrInsert(
                ['user' => $userName, 'rule' => 0, 'console' => $console],
                ['score' => $totScore, 'rps' => $totRps, 'flg' => 0, 'updated_at' => $now]
            );
        }
    }
    public function getTotalsTables(Request $request): JsonResponse
    {
        // リクエストからルールIDを取得
        $ruleId = (int)$request['id'];
        $console = (int)($request['console'] ?? 0);

        // ルールIDが一致し、flgが0のデータを取得し、rpsで降順に並び替え
        $totals = Total::where('rule', $ruleId)
            ->where('console', $console)
            ->where('flg', 0)
            ->orderByDesc('rps')
            ->get();

        // ruleId が 0 のときは、$totals に含まれるユーザー全員分の
        // 「ルール 0,20,30,40 以外」の rps を一括で取得しておく
        $subTotals = collect();
        if ($ruleId === 0) {
            // $totals で得たユーザー名を一意に取り出す
            $userNames = $totals->pluck('user')->unique();

            $subTotals = Total::whereIn('user', $userNames)
                ->where('flg', 0)
                ->where('console', $console)
                ->whereNotIn('rule', [0, 20, 30, 40])   // 0,20,30,40 を除外
                ->get()
                ->groupBy('user');
        }
        // 順位を付ける
        $rank = 1;
        $previousRps = null;
        $rankedTotals = $totals->map(function ($total, $index) use (&$rank, &$previousRps, $ruleId, $subTotals){
            if ($previousRps !== null && $total->rps !== $previousRps) {
                $rank = $index + 1; // 同じrpsの場合は順位を変えない
            }

            // 順位を付与
            $total->rank = $rank;
            $previousRps = $total->rps;

            // ruleId = 0 の場合は取得済みのサブルール rpsXX をすべて付与し、さらに rpsX の集計も行う
            if ($ruleId === 0 && $subTotals->has($total->user)) {
                // まず個別 rpsXY (例: rps21) を付与
                foreach ($subTotals[$total->user] as $sub) {
                    $prop = 'rps' . $sub->rule;   // 例: rps21
                    $total->{$prop} = $sub->rps;
                }
                // つづいて rpsXY → rpsX の集計を行う (X = 1,2,3,4)
                for ($grp = 1; $grp <= 4; $grp++) {
                    $sum = 0;
                    // `$total` は Eloquent モデルなので、属性は `$total->getAttributes()` で取得する
                    foreach ($total->getAttributes() as $k => $v) {
                        // rpsXY 形式 (rps + X + 1 文字以上の数字) が対象
                        if (preg_match('/^rps' . $grp . '\d+$/', $k) && is_numeric($v)) {
                            $sum += $v;
                        }
                    }
                    // 該当データがあった場合のみ rpsX を追加
                    if ($sum > 0) {
                        $total->{'rps' . $grp} = $sum;
                    }
                }
            }
            return $total;
        });
        $payload = $rankedTotals->toArray();
        // 結果をJSON形式で返す
        return response()->json($payload);
    }

    public function getDashboardSummary(Request $request): JsonResponse
    {
        $userId = (string)$request['id'];
        $latest = $this->getLatestRecordSummary($userId);
        $recommend = Cache::remember(
            'user:dashboard-summary:recommend:v3:' . $userId,
            3600,
            fn () => $this->getRecommendedStageSummary($userId)
        );
        $recommend = $this->withPersonalBestSummary($recommend, $userId);

        return response()->json([
            'latest' => $latest,
            'recommend' => $recommend,
            'hasTotalRankingRecords' => $latest !== null,
        ]);
    }

    private function getLatestRecordSummary(string $userId): ?array
    {
        $record = $this->getLatestRecord($userId);

        return $record ? $this->formatRecordSummary($record) : null;
    }

    private function getLatestRecord(string $userId): ?Record
    {
        return Record::where('user_id', $userId)
            ->where('rule', '<', 100)
            ->where('stage_id', '<', 1000)
            ->where('flg', '<', 2)
            ->orderByDesc('created_at')
            ->orderByDesc('post_id')
            ->first();
    }

    private function getRecommendedStageSummary(string $userId): ?array
    {
        $hasRecords = Record::where('user_id', $userId)
            ->where('rule', '<', 100)
            ->where('flg', '<', 2)
            ->exists();

        if (!$hasRecords) {
            return $this->randomUnpostedStageSummary(self::NORMAL_RECOMMEND_RULES, $userId);
        }

        $rule = $this->strongestSnapshotRule($userId);
        if ($rule !== null) {
            $stale = $this->stalePostedStageSummary($userId, $rule);
            if ($stale) {
                return $stale;
            }
        }

        $latestRuleRecommendation = $this->latestRuleRecommendedStageSummary($userId);
        if ($latestRuleRecommendation) {
            return $latestRuleRecommendation;
        }

        $postedRules = Record::where('user_id', $userId)
            ->where('rule', '<', 100)
            ->where('flg', '<', 2)
            ->whereIn('rule', self::RECOMMEND_RULES)
            ->distinct()
            ->pluck('rule')
            ->map(static fn ($rule) => (int)$rule)
            ->values()
            ->toArray();

        return $this->randomUnpostedStageSummary($postedRules, $userId)
            ?? $this->randomUnpostedStageSummary(self::NORMAL_RECOMMEND_RULES, $userId);
    }

    private function strongestSnapshotRule(string $userId): ?int
    {
        $latest = TotalSnapshot::where('user', $userId)
            ->where('flg', 0)
            ->whereIn('rule', self::RECOMMEND_RULES)
            ->orderByDesc('target_year')
            ->orderByDesc('target_month')
            ->first();

        if (!$latest) {
            return null;
        }

        $latestRows = TotalSnapshot::where('user', $userId)
            ->where('flg', 0)
            ->where('target_year', (int)$latest->target_year)
            ->where('target_month', (int)$latest->target_month)
            ->whereIn('rule', self::RECOMMEND_RULES)
            ->get()
            ->keyBy('rule');

        $previousRows = TotalSnapshot::where('user', $userId)
            ->where('flg', 0)
            ->where('target_year', (int)$latest->target_year - 1)
            ->where('target_month', (int)$latest->target_month)
            ->whereIn('rule', self::RECOMMEND_RULES)
            ->get()
            ->keyBy('rule');

        $deltas = [];
        foreach ($latestRows as $rule => $row) {
            $previous = $previousRows->get($rule);
            if (!$previous) {
                continue;
            }
            $deltas[] = [
                'rule' => (int)$rule,
                'delta' => (int)$row->rps - (int)$previous->rps,
            ];
        }

        if (!$deltas) {
            return null;
        }

        $max = max(array_column($deltas, 'delta'));
        $candidates = array_values(array_filter($deltas, static fn ($row) => $row['delta'] === $max));
        return $candidates[array_rand($candidates)]['rule'];
    }

    private function stalePostedStageSummary(string $userId, int $rule): ?array
    {
        $stages = TotalController::stage_list((string)$rule);
        if (!$stages) {
            return null;
        }

        $records = Record::where('user_id', $userId)
            ->where('rule', $rule)
            ->whereIn('stage_id', $stages)
            ->where('flg', '<', 2)
            ->orderBy('created_at')
            ->get()
            ->groupBy('stage_id')
            ->map(static fn ($rows) => $rows->sortByDesc('created_at')->first())
            ->sortBy('created_at')
            ->values();

        $candidates = $records->slice(2, 5)->values();
        if ($candidates->count() < 5) {
            return null;
        }

        return $this->formatRecordSummary($candidates->random());
    }

    private function latestRuleRecommendedStageSummary(string $userId): ?array
    {
        $latestRecord = $this->getLatestRecord($userId);
        if (!$latestRecord) {
            return null;
        }

        $rule = (int)$latestRecord->rule;
        return $this->randomUnpostedStageSummary([$rule], $userId)
            ?? $this->oldestPersonalBestStageSummary($userId, $rule);
    }

    private function oldestPersonalBestStageSummary(string $userId, int $rule): ?array
    {
        $stages = TotalController::stage_list((string)$rule);
        if (!$stages) {
            return null;
        }

        $orderBy = Func::orderByRule(0, $rule);
        $records = Record::where('user_id', $userId)
            ->where('rule', $rule)
            ->whereIn('stage_id', $stages)
            ->where('flg', '<', 2)
            ->orderBy($orderBy[0], $orderBy[1])
            ->orderBy('created_at')
            ->orderBy('post_id')
            ->get()
            ->groupBy('stage_id')
            ->map(static fn ($rows) => $rows->first())
            ->sortBy('created_at')
            ->values();

        return $records->isNotEmpty() ? $this->formatRecordSummary($records->first()) : null;
    }

    private function randomUnpostedStageSummary(array $rules, string $userId): ?array
    {
        $candidates = [];
        foreach ($rules as $rule) {
            $rule = (int)$rule;
            $stages = TotalController::stage_list((string)$rule);
            if (!$stages) {
                continue;
            }

            $postedStages = Record::where('user_id', $userId)
                ->where('rule', $rule)
                ->whereIn('stage_id', $stages)
                ->where('flg', '<', 2)
                ->distinct()
                ->pluck('stage_id')
                ->map(static fn ($stage) => (int)$stage)
                ->toArray();

            foreach (array_values(array_diff($stages, $postedStages)) as $stage) {
                $candidates[] = [
                    'stage_id' => (int)$stage,
                    'rule' => $rule,
                    'console' => 0,
                    'score' => null,
                    'created_at' => null,
                ];
            }
        }

        return $candidates ? $candidates[array_rand($candidates)] : null;
    }

    private function withPersonalBestSummary(?array $summary, string $userId): ?array
    {
        if (!$summary || !isset($summary['stage_id'], $summary['rule'])) {
            return $summary;
        }

        $record = $this->getPersonalBestRecord(
            $userId,
            (int)$summary['stage_id'],
            (int)$summary['rule']
        );

        if (!$record) {
            return array_merge($summary, [
                'score' => null,
                'created_at' => null,
            ]);
        }

        return $this->formatRecordSummary($record);
    }

    private function getPersonalBestRecord(string $userId, int $stageId, int $rule): ?Record
    {
        $orderBy = Func::orderByRule($stageId, $rule);

        return Record::where('user_id', $userId)
            ->where('stage_id', $stageId)
            ->where('rule', $rule)
            ->where('flg', '<', 2)
            ->orderBy($orderBy[0], $orderBy[1])
            ->orderBy('created_at')
            ->orderBy('post_id')
            ->first();
    }

    private function formatRecordSummary(Record $record): array
    {
        return [
            'stage_id' => (int)$record->stage_id,
            'rule' => (int)$record->rule,
            'console' => (int)$record->console,
            'score' => is_numeric($record->score) ? (int)$record->score : null,
            'created_at' => $record->created_at,
        ];
    }

    private function getCategoryRanks(string $userId, array $rules): array
    {
        $output = [];
        foreach ($rules as $rule) {
            $rule = (int)$rule;
            if (in_array($rule, [29, 35, 47], true)) {
                $ranking = $this->getCategoryRanking($rule, 0);
                $rankingRow = $this->findUserTotal($ranking, $userId);
                if ($rankingRow) {
                    $output[$rule] = $this->formatRankingRow($rankingRow, count($ranking));
                }
                continue;
            }

            $row = Total::where('user', $userId)
                ->where('rule', $rule)
                ->where('console', 0)
                ->where('flg', 0)
                ->first();

            if (!$row) {
                continue;
            }

            $rank = $this->getTotalScoreRank($rule, (int)$row->score);
            $output[$rule] = [
                'score' => (int)$row->score,
                'rps' => (int)$row->rps,
                'rank' => $rank['rank'],
                'participants' => $rank['participants'],
            ];
        }
        return $output;
    }

    private function getConsoleCategoryScores(string $userId): array
    {
        $output = [];
        foreach (self::CONSOLE_CATEGORY_RULES as $rule) {
            foreach ($this->consoleIdsForRule($rule) as $console) {
                $ranking = $this->getCategoryRanking($rule, $console);
                $row = $this->findUserTotal($ranking, $userId);
                if (!$row) {
                    continue;
                }
                $formatted = $this->formatRankingRow($row, count($ranking));
                $formatted['console'] = $console;
                $output[$rule][$console] = $formatted;
                $this->updateConsoleTotalRow($userId, $rule, $console, $formatted);
            }
        }
        return $output;
    }

    private function getCategoryRanking(int $rule, int $console): array
    {
        $req = new Request(['id' => $rule, 'rule' => $rule, 'console' => $console, 'year' => date('Y')]);
        return (new TotalController())->getTotals($req);
    }

    private function findUserTotal(array $ranking, string $userId): ?array
    {
        foreach ($ranking as $row) {
            if (($row['user_id'] ?? null) === $userId) {
                return $row;
            }
        }
        return null;
    }

    private function formatRankingRow(array $row, int $participants): array
    {
        return [
            'score' => (int)round((float)($row['score'] ?? 0)),
            'rps' => (int)round((float)($row['rps'] ?? 0)),
            'mark' => isset($row['ranks']) && is_array($row['ranks']) ? count($row['ranks']) : 0,
            'rank' => (int)($row['post_rank'] ?? 0),
            'participants' => $participants,
        ];
    }

    private function updateConsoleTotalRow(string $userId, int $rule, int $console, array $row): void
    {
        DB::table('totals')->updateOrInsert(
            ['user' => $userId, 'rule' => $rule, 'console' => $console],
            [
                'score' => $row['score'],
                'rps' => $row['rps'],
                'flg' => 0,
                'updated_at' => now(),
            ]
        );
    }

    private function getTotalScoreRank(int $rule, int $score): array
    {
        $participants = Total::where('rule', $rule)
            ->where('console', 0)
            ->where('flg', 0)
            ->where('score', '>', 0)
            ->count();

        $higher = Total::where('rule', $rule)
            ->where('console', 0)
            ->where('flg', 0)
            ->where('score', '>', $score)
            ->count();

        return [
            'rank' => $score > 0 ? $higher + 1 : 0,
            'participants' => $participants,
        ];
    }

    private function consoleIdsForRule(int $rule): array
    {
        return Record::whereIn('stage_id', TotalController::stage_list($rule))
            ->whereIn('rule', $this->rulesForCategory($rule))
            ->where('console', '>', 0)
            ->where('flg', '<', 2)
            ->distinct()
            ->orderBy('console')
            ->pluck('console')
            ->map(static fn ($console) => (int)$console)
            ->values()
            ->toArray();
    }

    private function rulesForCategory(int $rule): array
    {
        return match ($rule) {
            20 => [20, 21, 22],
            30 => [30, 31, 32, 33, 36],
            40 => [40, 41, 42, 43],
            default => [$rule],
        };
    }

    public function getRpsHistory(Request $request): JsonResponse
    {
        $userId = (string)$request['id'];
        $ruleId = (int)($request['rule'] ?? 0);
        $withRivals = (int)($request->query('rivals', 0)) === 1;
        $requestedYear = (int)($request->query('year', (int)date('Y')));
        $currentYear = (int)date('Y');
        $limit = 24;

        $latest = $requestedYear >= $currentYear
            ? TotalSnapshot::where('rule', 0)
                ->where('flg', 0)
                ->orderByDesc('target_year')
                ->orderByDesc('target_month')
                ->first()
            : TotalSnapshot::where('rule', 0)
                ->where('flg', 0)
                ->where('target_year', $requestedYear)
                ->where('target_month', 12)
                ->first();

        if (!$latest) {
            $fallbackMonth = $requestedYear >= $currentYear ? (int)date('n') : 12;
            $monthKeys = $this->recentMonthKeys($requestedYear, $fallbackMonth, $limit);
            return response()->json([
                'rule' => $ruleId,
                'latest' => [
                    'year' => $requestedYear,
                    'month' => $fallbackMonth,
                ],
                'series' => [
                    [
                        'user' => $userId,
                        'items' => array_map(static fn ($month) => [
                            'year' => $month['year'],
                            'month' => $month['month'],
                            'label' => sprintf('%04d/%02d', $month['year'], $month['month']),
                            'score' => null,
                            'rps' => null,
                            'rank' => null,
                            'delta' => null,
                        ], $monthKeys),
                    ],
                ],
            ]);
        }

        $targetUsers = [$userId];
        if ($withRivals) {
            $targetUsers = array_values(array_unique(array_merge(
                $targetUsers,
                $this->getRivalUsers($userId, (int)$latest->target_year, (int)$latest->target_month, $ruleId)
            )));
        }

        $monthKeys = $this->recentMonthKeys((int)$latest->target_year, (int)$latest->target_month, $limit);
        $min = $monthKeys[0];

        $rows = TotalSnapshot::where('rule', $ruleId)
            ->where('flg', 0)
            ->whereIn('user', $targetUsers)
            ->where(static function ($query) use ($min) {
                $query->where('target_year', '>', $min['year'])
                    ->orWhere(static function ($q) use ($min) {
                        $q->where('target_year', $min['year'])
                            ->where('target_month', '>=', $min['month']);
                    });
            })
            ->orderBy('target_year')
            ->orderBy('target_month')
            ->get()
            ->groupBy('user');

        $series = [];
        foreach ($targetUsers as $targetUser) {
            $byMonth = ($rows[$targetUser] ?? collect())->keyBy(static function ($row) {
                return sprintf('%04d-%02d', $row->target_year, $row->target_month);
            });
            $items = [];
            $previousRps = null;
            foreach ($monthKeys as $month) {
                $key = sprintf('%04d-%02d', $month['year'], $month['month']);
                $row = $byMonth->get($key);
                $rps = $row ? (int)$row->rps : null;
                $items[] = [
                    'year' => $month['year'],
                    'month' => $month['month'],
                    'label' => sprintf('%04d/%02d', $month['year'], $month['month']),
                    'score' => $row ? (int)$row->score : null,
                    'rps' => $rps,
                    'rank' => $row ? (int)$row->rank : null,
                    'delta' => ($rps !== null && $previousRps !== null) ? $rps - $previousRps : null,
                ];
                if ($rps !== null) {
                    $previousRps = $rps;
                }
            }
            $series[] = [
                'user' => $targetUser,
                'items' => $items,
            ];
        }

        return response()->json([
            'rule' => $ruleId,
            'latest' => [
                'year' => (int)$latest->target_year,
                'month' => (int)$latest->target_month,
            ],
            'series' => $series,
        ]);
    }

    public function getMonthlyMnp(): JsonResponse
    {
        $targetCount = 12;
        $latest = TotalSnapshot::where('rule', 0)
            ->where('flg', 0)
            ->orderByDesc('target_year')
            ->orderByDesc('target_month')
            ->first();

        if (!$latest) {
            return response()->json([]);
        }

        $result = [];
        $baseMonth = Carbon::create((int)$latest->target_year, (int)$latest->target_month, 1);

        for ($i = 0; count($result) < $targetCount && $i < 240; $i++) {
            $targetMonth = (clone $baseMonth)->subMonthsNoOverflow($i);
            $current = TotalSnapshot::where('rule', 0)
                ->where('flg', 0)
                ->where('target_year', (int)$targetMonth->format('Y'))
                ->where('target_month', (int)$targetMonth->format('n'))
                ->get();

            if ($current->isEmpty()) {
                continue;
            }

            $previousMonth = (clone $targetMonth)->subMonthNoOverflow();
            $previous = TotalSnapshot::where('rule', 0)
                ->where('flg', 0)
                ->where('target_year', (int)$previousMonth->format('Y'))
                ->where('target_month', (int)$previousMonth->format('n'))
                ->pluck('rps', 'user');

            $best = null;
            foreach ($current as $row) {
                $delta = (int)$row->rps - (int)($previous[$row->user] ?? 0);
                if ($best === null || $delta > $best['delta']) {
                    $best = [
                        'year' => (int)$row->target_year,
                        'month' => (int)$row->target_month,
                        'label' => sprintf('%04d年%02d月', $row->target_year, $row->target_month),
                        'user' => $row->user,
                        'rps' => (int)$row->rps,
                        'previous_rps' => (int)($previous[$row->user] ?? 0),
                        'delta' => $delta,
                        'rank' => (int)$row->rank,
                    ];
                }
            }

            if ($best && $best['delta'] > 0) {
                $result[] = $best;
            }
        }

        return response()->json($result);
    }

    private function getRivalUsers(string $userId, int $year, int $month, int $ruleId): array
    {
        $ranking = TotalSnapshot::where('rule', $ruleId)
            ->where('flg', 0)
            ->where('target_year', $year)
            ->where('target_month', $month)
            ->where('rps', '>', 0)
            ->orderByDesc('rps')
            ->orderBy('user')
            ->get()
            ->values();

        $index = $ranking->search(static fn ($row) => $row->user === $userId);
        if ($index === false) {
            return [];
        }

        $candidates = $ranking
            ->map(static function ($row, $position) use ($userId, $index) {
                return [
                    'user' => $row->user,
                    'position' => $position,
                    'distance' => abs($position - $index),
                    'is_above' => $position < $index,
                    'is_eligible' => $row->user !== $userId,
                ];
            })
            ->filter(static fn ($row) => $row['is_eligible'])
            ->sort(static function ($a, $b) {
                if ($a['distance'] !== $b['distance']) {
                    return $a['distance'] <=> $b['distance'];
                }
                if ($a['is_above'] !== $b['is_above']) {
                    return $a['is_above'] ? -1 : 1;
                }
                return $a['position'] <=> $b['position'];
            })
            ->take(2)
            ->pluck('user')
            ->toArray();

        return $candidates;
    }

    private function recentMonthKeys(int $year, int $month, int $limit): array
    {
        $start = Carbon::create($year, $month, 1)->subMonthsNoOverflow($limit - 1);
        $keys = [];
        for ($i = 0; $i < $limit; $i++) {
            $current = (clone $start)->addMonthsNoOverflow($i);
            $keys[] = [
                'year' => (int)$current->format('Y'),
                'month' => (int)$current->format('n'),
            ];
        }
        return $keys;
    }
    public function aggregateScores($array, $mode = "score"): array
    {
        $output = [];

        foreach ($array as $data) {
            $rule = $data["rule"];
            $score = ($mode === "score")
                ? TotalController::scoreForTotal((int)$rule, (int)$data["score"])
                : $data["rps"];

            // 各ruleごとに初期化
            if (!isset($output[$rule])) {
                $output[$rule] = 0;
            }

            // スコアを加算
            $output[$rule] += $score;

            if($rule === 21 || $rule === 22){
                if (!isset($output["20"])) {
                    $output["20"] = 0;
                }
                $output["20"] += $score;
            }
            if($rule === 31 || $rule === 32 || $rule === 33 || $rule === 36){
                if(!isset($output["30"])){
                    $output["30"] = 0;
                }
                $output["30"] += $score;
            }
            if($rule === 41 || $rule === 42 || $rule === 43){
                if(!isset($output["40"])){
                    $output["40"] = 0;
                }
                $output["40"] += $score;
            }
        }
        return $output;
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
