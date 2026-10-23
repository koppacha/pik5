<?php

namespace App\Services;

use App\Library\Func;
use App\Models\Record;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class YearRecords
{
    public const TTL = 30 * 86400;
    private const NORMAL = [10, 20, 21, 22, 30, 31, 32, 33, 36, 40, 41, 42, 43, 48];

    public static function validateYear(string $year): int
    {
        abort_unless(preg_match('/\A[0-9]{4}\z/', $year) && (int) $year >= 2014
            && (int) $year <= CarbonImmutable::now('Asia/Tokyo')->year, 404);
        return (int) $year;
    }

    private function key(int $year): string
    {
        return 'year-records:v1:'.$year.':'.Record::publicVisibilityCacheKey().':'.md5(json_encode(DandoriCatalog::ids()));
    }

    public function forget(int $year): void
    {
        $key = $this->key($year);
        Cache::lock($key.':lock', 120)->block(30, fn () => Cache::forget($key));
    }

    public function get(int $year): array
    {
        $now = CarbonImmutable::now('Asia/Tokyo');
        if ($year === $now->year) return $this->build($year, $now, true);
        $key = $this->key($year);
        if (($cached = Cache::get($key)) !== null) return $cached;
        return Cache::lock($key.':lock', 120)->block(30, function () use ($key, $year, $now) {
            return Cache::remember($key, self::TTL, fn () => $this->build($year, $now, false));
        });
    }

    private function build(int $year, CarbonImmutable $now, bool $current): array
    {
        $cutoff = $current ? $now : CarbonImmutable::create($year + 1, 1, 1, 0, 0, 0, 'Asia/Tokyo');
        $date = $cutoff->format('Y-m-d H:i:s');
        $membershipDate = $current ? $cutoff->addSecond()->format('Y-m-d H:i:s') : $date;
        $published = DandoriCatalog::ids($membershipDate);
        $rows = Record::publiclyVisible()->join('stages', 'stages.stage_id', '=', 'records.stage_id')
            ->select(array_merge(array_map(fn ($column) => 'records.'.$column, config('const.selected')), [
                'stages.stage_name', 'stages.eng_stage_name', 'stages.stage_code', 'stages.parent', 'stages.display',
            ]))
            ->where('records.flg', '<', 2)->where('records.console', '>', 0)->where('records.difficulty', '>', 0)
            ->where('records.created_at', $current ? '<=' : '<', $date)->toBase()->get()->map(fn ($row) => (array) $row)->all();
        $decks = DB::table('decks')->get()->keyBy('stage_id');
        $links = DB::table('trick_event_records')->get(['record_id', 'event_id'])->keyBy('record_id');
        $groups = [];
        foreach ($rows as $row) {
            $row['is_certified'] = RecordCertification::isCertified((int) $row['rule'], $row['post_memo'] ?? null);
            unset($row['post_memo']);
            $stage = (int) $row['stage_id'];
            $rule = (int) $row['rule'];
            if (($rule === 48 || (int) $row['parent'] === 48) && ! in_array($stage, $published, true)) continue;
            $deck = $decks->get($stage);
            $event = $links->get($row['post_id'])?->event_id;
            $eventRule = $deck && in_array($rule, [1, (int) $row['parent']], true);
            $groupRule = $eventRule ? (int) $row['parent'] : $rule;
            $row['list_category'] = ($event || $eventRule || ($stage >= 1001 && $stage <= 1999))
                ? 'limited' : (in_array($rule, self::NORMAL, true) ? 'normal' : 'special');
            $row['score_type'] = ($stage >= 1001 && $stage <= 1999) ? ($row['display'] === 'time' ? 'time' : 'points') : null;
            if ($rule === 48) $row['score_type'] = DandoriCatalog::settings($stage)?->score_type ?? $row['score_type'];
            if ($eventRule) {
                $row['event_rule_name'] = $deck->rule_name;
            }
            $groups[$stage.':'.$groupRule]['rows'][] = $row;
            $groups[$stage.':'.$groupRule]['rules'] = $eventRule ? [1, (int) $row['parent']] : [$rule];
        }
        $categories = ['normal' => [], 'special' => [], 'limited' => []];
        $maximums = [];
        foreach ($groups as $group) {
            $first = $group['rows'][0];
            $rules = $group['rules'];
            $best = StageRecordRanking::best($group['rows'], (int) $first['stage_id'], (int) $first['rule']);
            $total = $rules[0] > 10000 ? $rules[0] : 0;
            if (! array_key_exists($total, $maximums)) {
                $members = Func::memberCount($total, [0, $rules, $membershipDate]);
                $maximums[$total] = $members ? max($members) : null;
            }
            $ranked = Func::rank_calc('stage', $best, [0, $rules, $date], $maximums[$total] ?? count($best));
            foreach ($ranked as $row) {
                if ($year > 2014 && substr($row['created_at'], 0, 4) !== (string) $year) continue;
                $category = $row['list_category'];
                unset($row['list_category'], $row['display'], $row['parent']);
                $row['created_at'] = CarbonImmutable::parse($row['created_at'], 'Asia/Tokyo')->toIso8601String();
                $categories[$category][] = $row;
            }
        }
        foreach ($categories as &$records) {
            usort($records, fn ($a, $b) => ($b['rps'] <=> $a['rps'])
                ?: strcmp($a['created_at'], $b['created_at']) ?: ($a['post_id'] <=> $b['post_id']));
        }
        return ['year' => $year, 'asOf' => ($current ? $now : $cutoff->subSecond())->toIso8601String(),
            'generatedAt' => $now->toIso8601String(), 'categories' => $categories];
    }
}
