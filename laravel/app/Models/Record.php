<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Record extends Model
{
    use HasFactory;

    /**
     * Primary key settings.
     */
    protected $primaryKey = 'post_id';
    public $incrementing = true;
    protected $keyType = 'int';

    /**
     * 複数代入可能な属性
     *
     * @var array
     */
    protected $guarded = [
      'created_at',
    ];
    // 公開経路だけに適用する。大会内の取得・更新・投稿数集計には適用しない。
    public function scopePubliclyVisible(Builder $query): Builder
    {
        return $query->whereNotExists(function (QueryBuilder $events) {
            $events->selectRaw('1')->from('trick_events');
            self::duringEvent($events);
            $events->where(function (QueryBuilder $target) {
                $target->whereExists(function (QueryBuilder $links) {
                    $links->selectRaw('1')->from('trick_event_records')
                        ->whereColumn('trick_event_records.event_id', 'trick_events.event_id')
                        ->whereColumn('trick_event_records.record_id', 'records.post_id');
                })->orWhere(function (QueryBuilder $period) {
                    // 紐付けのない旧記録・再編集履歴も、対象ステージと開催期間で遮断する。
                    $period->whereColumn('records.created_at', '>=', 'trick_events.start_at')
                        ->whereColumn('records.created_at', '<', 'trick_events.end_at')
                        ->whereExists(function (QueryBuilder $cards) {
                            $cards->selectRaw('1')->from('trick_event_cards')
                                ->join('decks', 'decks.id', '=', 'trick_event_cards.deck_id')
                                ->whereColumn('trick_event_cards.event_id', 'trick_events.event_id')
                                ->whereColumn('decks.stage_id', 'records.stage_id');
                        });
                });
            });
        });
    }

    private static function duringEvent(QueryBuilder $query): void
    {
        // 最終集計のstate/ended_at更新を待たず、end_atの瞬間から公開する。
        $clock = 'CASE WHEN (trick_events.debug = 1 OR trick_events.test_mode = 1) AND trick_events.debug_now IS NOT NULL THEN trick_events.debug_now ELSE ? END';
        $now = CarbonImmutable::now()->format('Y-m-d H:i:s');
        $query->whereRaw("trick_events.start_at <= ($clock)", [$now])
            ->whereRaw("trick_events.end_at > ($clock)", [$now]);
    }

    public static function publicVisibilityCacheKey(): string
    {
        $events = DB::table('trick_events');
        self::duringEvent($events);

        return 'public-records-v1:'.md5($events->orderBy('event_id')->get(['event_id', 'start_at', 'end_at'])->toJson());
    }

    public function user(): HasOne
    {
        return $this->hasOne(User::class,'user_id','user_id');
    }
}
