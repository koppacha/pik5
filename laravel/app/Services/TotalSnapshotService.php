<?php

namespace App\Services;

use App\Http\Controllers\TotalController;
use App\Models\Record;
use App\Models\TotalSnapshot;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class TotalSnapshotService
{
    private const MIN_YEAR = 2007;
    private const MIN_MONTH = 4;
    private const TOTAL_RULE = 0;
    private const SUMMARY_RULES = [20, 30, 40];
    private const CONSOLE_TOTAL_RULES = [10, 20, 30];
    private const CONSOLE_CLEANUP_RULES = [10, 20, 30, 40];

    public function snapshotAt(int $year, int $month): Carbon
    {
        if ($year < self::MIN_YEAR || ($year === self::MIN_YEAR && $month < self::MIN_MONTH)) {
            throw new \InvalidArgumentException('2007/4より前の月次スナップショットは作成できません。');
        }
        if ($month < 1 || $month > 12) {
            throw new \InvalidArgumentException('month must be between 1 and 12.');
        }
        return Carbon::create($year, $month, 1, 23, 59, 59)->endOfMonth();
    }

    public function storeMonth(int $year, int $month): array
    {
        $snapshotAt = $this->snapshotAt($year, $month);
        $rows = $this->buildRows($snapshotAt);

        DB::transaction(static function () use ($year, $month, $rows) {
            TotalSnapshot::where('target_year', $year)
                ->where('target_month', $month)
                ->delete();

            foreach (array_chunk($rows, 500) as $chunk) {
                TotalSnapshot::insert($chunk);
            }
        });

        return [
            'year' => $year,
            'month' => $month,
            'snapshot_at' => $snapshotAt->format('Y-m-d H:i:s'),
            'rows' => count($rows),
        ];
    }

    public function updateLatestTotals(): array
    {
        $snapshotAt = Carbon::now();
        $rows = $this->buildRows($snapshotAt);
        $consoleRows = $this->buildLatestConsoleRows($snapshotAt);
        $now = Carbon::now();
        $count = 0;

        DB::transaction(static function () use ($rows, $consoleRows, $now, &$count) {
            DB::table('totals')
                ->whereIn('rule', self::CONSOLE_CLEANUP_RULES)
                ->where('console', '>', 0)
                ->delete();

            foreach ($rows as $row) {
                DB::table('totals')->updateOrInsert(
                    ['user' => $row['user'], 'rule' => $row['rule'], 'console' => 0],
                    [
                        'score' => $row['score'],
                        'rps' => $row['rps'],
                        'flg' => $row['flg'],
                        'updated_at' => $now,
                    ]
                );
                $count++;
            }

            foreach ($consoleRows as $row) {
                DB::table('totals')->updateOrInsert(
                    ['user' => $row['user'], 'rule' => $row['rule'], 'console' => $row['console']],
                    [
                        'score' => $row['score'],
                        'rps' => $row['rps'],
                        'flg' => $row['flg'],
                        'updated_at' => $now,
                    ]
                );
                $count++;
            }
        });

        return ['rows' => $count];
    }

    private function buildLatestConsoleRows(Carbon $snapshotAt): array
    {
        $rows = [];
        foreach (self::CONSOLE_TOTAL_RULES as $rule) {
            $consoles = $this->consoleIdsForRule($rule);
            foreach ($consoles as $console) {
                $request = new Request([
                    'id' => $rule,
                    'rule' => $rule,
                    'console' => $console,
                    'year' => (int)$snapshotAt->format('Y'),
                    'snapshot_at' => $snapshotAt->format('Y-m-d H:i:s'),
                ]);
                $totals = (new TotalController())->getTotals($request);
                foreach ($totals as $userTotal) {
                    $rows[] = [
                        'user' => $userTotal['user_id'],
                        'rule' => $rule,
                        'console' => $console,
                        'score' => $this->sanitizeInt($userTotal['score'] ?? 0),
                        'rps' => $this->sanitizeInt($userTotal['rps'] ?? 0),
                        'flg' => 0,
                    ];
                }
            }
        }
        return $rows;
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

    private function buildRows(Carbon $snapshotAt): array
    {
        $request = new Request([
            'id' => 1,
            'rule' => 1,
            'console' => 0,
            'year' => (int)$snapshotAt->format('Y'),
            'snapshot_at' => $snapshotAt->format('Y-m-d H:i:s'),
        ]);

        $totals = (new TotalController())->getTotals($request);
        $rows = [];
        $targetYear = (int)$snapshotAt->format('Y');
        $targetMonth = (int)$snapshotAt->format('n');
        $now = Carbon::now()->format('Y-m-d H:i:s');

        foreach ($totals as $userTotal) {
            if (!isset($userTotal['user_id'], $userTotal['ranks']) || !is_array($userTotal['ranks'])) {
                continue;
            }

            $scores = $this->aggregate($userTotal['ranks']);
            $rps = $this->aggregate($userTotal['ranks'], 'rps');
            $marks = $this->aggregateMarks($userTotal['ranks']);
            $totalScore = $this->sumWithoutSummaryRules($scores);
            $totalRps = $this->sumWithoutSummaryRules($rps);
            $totalMark = $this->sumWithoutSummaryRules($marks);

            $rows[] = $this->makeRow($targetYear, $targetMonth, $snapshotAt, $now, $userTotal['user_id'], self::TOTAL_RULE, $totalScore, $totalRps, $totalMark);

            foreach ($scores as $rule => $score) {
                if (!isset($rps[$rule])) {
                    continue;
                }
                $rows[] = $this->makeRow(
                    $targetYear,
                    $targetMonth,
                    $snapshotAt,
                    $now,
                    $userTotal['user_id'],
                    (int)$rule,
                    $score,
                    $rps[$rule],
                    $marks[$rule] ?? 0
                );
            }
        }

        return $this->assignRanks($rows);
    }

    private function makeRow(
        int $year,
        int $month,
        Carbon $snapshotAt,
        string $now,
        string $user,
        int $rule,
        int|float $score,
        int|float $rps,
        int|float $mark
    ): array {
        return [
            'created_at' => $now,
            'updated_at' => $now,
            'target_year' => $year,
            'target_month' => $month,
            'snapshot_at' => $snapshotAt->format('Y-m-d H:i:s'),
            'user' => $user,
            'rule' => $rule,
            'score' => $this->sanitizeInt($score),
            'rps' => $this->sanitizeInt($rps),
            'mark' => $this->sanitizeInt($mark),
            'rank' => null,
            'flg' => 0,
        ];
    }

    private function aggregate(array $ranks, string $mode = 'score'): array
    {
        $output = [];
        foreach ($ranks as $data) {
            $rule = (int)$data['rule'];
            $value = $mode === 'score' ? ($data['score'] ?? 0) : ($data['rps'] ?? 0);
            $output[$rule] = ($output[$rule] ?? 0) + $value;

            if ($rule === 21 || $rule === 22) {
                $output[20] = ($output[20] ?? 0) + $value;
            }
            if ($rule === 31 || $rule === 32 || $rule === 33 || $rule === 36) {
                $output[30] = ($output[30] ?? 0) + $value;
            }
            if ($rule === 41 || $rule === 42 || $rule === 43) {
                $output[40] = ($output[40] ?? 0) + $value;
            }
        }
        return $output;
    }

    private function aggregateMarks(array $ranks): array
    {
        $output = [];
        foreach ($ranks as $data) {
            $rule = (int)$data['rule'];
            $output[$rule] = ($output[$rule] ?? 0) + 1;

            if ($rule === 21 || $rule === 22) {
                $output[20] = ($output[20] ?? 0) + 1;
            }
            if ($rule === 31 || $rule === 32 || $rule === 33 || $rule === 36) {
                $output[30] = ($output[30] ?? 0) + 1;
            }
            if ($rule === 41 || $rule === 42 || $rule === 43) {
                $output[40] = ($output[40] ?? 0) + 1;
            }
        }
        return $output;
    }

    private function sumWithoutSummaryRules(array $values): int
    {
        return $this->sanitizeInt(array_sum(array_filter(
            $values,
            static fn ($value, $rule) => !in_array((int)$rule, self::SUMMARY_RULES, true),
            ARRAY_FILTER_USE_BOTH
        )));
    }

    private function assignRanks(array $rows): array
    {
        $groups = [];
        foreach ($rows as $index => $row) {
            $groups[$row['rule']][] = $index;
        }

        foreach ($groups as $indexes) {
            usort($indexes, static fn ($a, $b) => $rows[$b]['rps'] <=> $rows[$a]['rps']);
            $rank = 1;
            $previous = null;
            foreach ($indexes as $position => $rowIndex) {
                if ($previous !== null && $rows[$rowIndex]['rps'] !== $previous) {
                    $rank = $position + 1;
                }
                $rows[$rowIndex]['rank'] = $rank;
                $previous = $rows[$rowIndex]['rps'];
            }
        }

        return $rows;
    }

    private function sanitizeInt($value, int $max = 9999999): int
    {
        $number = is_numeric($value) ? (float)$value : 0.0;
        if (is_infinite($number) || is_nan($number)) {
            Log::warning('TotalSnapshotService sanitize: non-finite value', ['value' => $value]);
            $number = 0.0;
        }
        if ($number > $max) {
            $number = (float)$max;
        }
        if ($number < 0) {
            $number = 0.0;
        }
        return (int)round($number);
    }
}
