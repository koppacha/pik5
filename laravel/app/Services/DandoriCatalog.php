<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DandoriCatalog
{
    public static function ids(?string $before = null): array
    {
        if (! Schema::hasTable('dandori_releases')) {
            return [];
        }
        return DB::table('dandori_slots as slot')
            ->join('dandori_releases as release', 'release.id', '=', 'slot.release_id')
            ->whereNotNull('release.publish_at')->where('release.publish_at', '<=', now()->utc())
            ->where('release.month', '<=', now('Asia/Tokyo')->format('Y-m'))
            ->when($before, fn ($q) => $q->where('release.publish_at', '<', \Carbon\CarbonImmutable::parse($before, config('app.timezone'))->utc()))
            ->distinct()->pluck('slot.stage_id')->map(fn ($id) => (int) $id)->all();
    }

    public static function monthly(): array
    {
        if (! Schema::hasTable('dandori_releases')) {
            return ['month' => null, 'source_month' => null, 'monthly' => []];
        }
        $current = CarbonImmutable::now('Asia/Tokyo')->startOfMonth();
        foreach ([$current, $current->subMonth()] as $displayMonth) {
            $sourceMonth = $displayMonth;
            if ($displayMonth->format('Y-m') >= '2027-11') {
                $offset = (($displayMonth->year - 2026) * 12 + $displayMonth->month - 11) % 12;
                $sourceMonth = CarbonImmutable::create(2026, 11, 1, 0, 0, 0, 'Asia/Tokyo')->addMonths($offset);
            }
            $release = DB::table('dandori_releases')->where('month', $sourceMonth->format('Y-m'))
                ->whereNotNull('publish_at')->where('publish_at', '<=', now()->utc())->first();
            if (! $release) continue;
            $ids = DB::table('dandori_slots')->where('release_id', $release->id)->orderBy('position')->limit(6)->pluck('stage_id')->all();
            $stages = self::stages($ids);
            if (count($stages) !== 6) continue;
            return ['month' => $displayMonth->format('Y-m'), 'source_month' => $sourceMonth->format('Y-m'), 'monthly' => $stages];
        }
        return ['month' => null, 'source_month' => null, 'monthly' => []];
    }

    public static function settings(int $id): ?object
    {
        // Ranking comparisons may resolve one stage thousands of times in a request.
        $cache = request()->attributes->get('dandori_settings_cache', []);
        if (array_key_exists($id, $cache)) return $cache[$id];
        $cache[$id] = Schema::hasTable('dandori_stages') ? DB::table('dandori_stages')->where('stage_id', $id)->first() : null;
        request()->attributes->set('dandori_settings_cache', $cache);
        return $cache[$id];
    }

    public static function stages(array $ids): array
    {
        if (! $ids) {
            return [];
        }
        return DB::table('stages as stage')->join('dandori_stages as config', 'config.stage_id', '=', 'stage.stage_id')
            ->whereIn('stage.stage_id', $ids)->select('stage.*', 'config.score_type', 'config.score_order', 'config.total_base', 'config.consoles', 'config.require_video', 'config.require_image')
            ->get()->map(function ($row) {
                $row->first_publish_at = DB::table('dandori_slots as slot')->join('dandori_releases as release', 'release.id', '=', 'slot.release_id')->where('slot.stage_id', $row->stage_id)->whereNotNull('release.publish_at')->min('release.publish_at');
                if ($row->first_publish_at) $row->first_publish_at = str_replace(' ', 'T', $row->first_publish_at).'Z';
                $row->consoles = json_decode($row->consoles, true);
                $row->stage_code = $row->stage_code ?: (string) $row->stage_id;
                return (array) $row;
            })->sortBy(fn ($row) => array_search((int) $row['stage_id'], array_map('intval', $ids), true))->values()->all();
    }
}
