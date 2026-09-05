<?php

namespace App\Services\Tricks;

use App\Models\Deck;
use App\Models\LimitLog;
use App\Models\Player;
use App\Models\TrickCardHolder;
use App\Models\TrickCollectionReward;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TrickCollectionService
{
    public function __construct(
        private readonly TrickClock $clock,
        private readonly TrickRuleCalculator $rules,
        private readonly TrickRewardDistributor $rewards,
        private readonly TrickRecordService $records,
        private readonly TrickStateService $state,
    ) {
    }

    public function collect(
        TrickEvent $event,
        int $deckId,
        bool $force = false,
        string $actor = null,
        Request $request = null,
    ): array {
        return DB::transaction(function () use ($event, $deckId, $force, $actor, $request): array {
            $event = TrickEvent::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();
            $card = TrickEventCard::query()->with('deck')->where('event_id', $event->event_id)
                ->where('deck_id', $deckId)->lockForUpdate()->firstOrFail();
            if ($card->state === '_collected') {
                return $this->payload($card, false);
            }
            if ($card->state !== '_field') {
                abort(response()->json(['message' => '回収対象は場札ではありません'], 409));
            }
            $now = $this->clock->now($event);
            if (! $force && $now->lessThan($event->end_at)
                && ($card->limit_at === null || $now->lessThan($card->limit_at))) {
                abort(response()->json(['message' => '回収期限前です'], 422));
            }

            $rankings = $this->records->rankings($card);
            $playerNames = collect($rankings)->pluck('user_id')
                ->when($card->taker !== null, fn ($names) => $names->push($card->taker))
                ->unique()->values();
            $players = Player::query()->where('event_id', $event->event_id)
                ->whereIn('name', $playerNames)->lockForUpdate()->get()->keyBy('name');
            $distribution = [];
            $takerRemainder = 0;
            $holders = [];

            if ($rankings !== []) {
                foreach ($rankings as $ranking) {
                    $player = $players->get($ranking['user_id']);
                    if ($player === null) {
                        abort(response()->json(['message' => 'ランキング参加者が大会参加者に存在しません'], 409));
                    }
                    $player->increment('rank_points', $ranking['rps']);
                }

                if (count($rankings) === 1) {
                    $distribution[$rankings[0]['user_id']] = max(0, $card->stack_count + $card->paid_points_total);
                    $rewardType = 'single_fixed';
                } else {
                    $rankGroups = collect($rankings)->groupBy('rank')->values()
                        ->map(fn ($group) => $group->pluck('user_id')->values()->all())->all();
                    $result = $this->rewards->distribute(
                        $this->rules->totalReward($card->stack_count, $card->paid_points_total, $card->difficulty),
                        $rankGroups,
                    );
                    $distribution = $result['distribution'];
                    $takerRemainder = $result['taker_remainder'];
                    $rewardType = 'rank_distribution';
                }

                foreach ($distribution as $playerName => $points) {
                    if ($points <= 0) {
                        continue;
                    }
                    $reward = TrickCollectionReward::query()->firstOrCreate([
                        'event_id' => $event->event_id,
                        'deck_id' => $card->deck_id,
                        'player_name' => $playerName,
                        'reward_type' => $rewardType,
                    ], [
                        'event_card_id' => $card->id,
                        'points_delta' => $points,
                    ]);
                    if ($reward->wasRecentlyCreated) {
                        $players->get($playerName)?->increment('draw_points', $points);
                    }
                }
                if ($takerRemainder > 0) {
                    $taker = $card->taker ? $players->get($card->taker) : null;
                    if ($taker === null) {
                        abort(response()->json(['message' => '端数還元先のテイカーが存在しません'], 409));
                    }
                    $reward = TrickCollectionReward::query()->firstOrCreate([
                        'event_id' => $event->event_id,
                        'deck_id' => $card->deck_id,
                        'player_name' => $taker->name,
                        'reward_type' => 'taker_remainder',
                    ], [
                        'event_card_id' => $card->id,
                        'points_delta' => $takerRemainder,
                    ]);
                    if ($reward->wasRecentlyCreated) {
                        $taker->increment('draw_points', $takerRemainder);
                    }
                }

                $holders = collect($rankings)->where('rank', 1)->pluck('user_id')->values()->all();
                foreach ($holders as $holder) {
                    TrickCardHolder::query()->firstOrCreate([
                        'event_id' => $event->event_id,
                        'deck_id' => $card->deck_id,
                        'player_name' => $holder,
                    ], ['event_card_id' => $card->id]);
                }
                Deck::query()->whereKey($card->deck_id)->update(['state' => '_held']);
            }

            TrickEventCard::query()->where('event_id', $event->event_id)
                ->where('stack_parent_id', $card->id)->where('state', '_stack')
                ->lockForUpdate()->update(['state' => '_trash']);
            $card->fill(['state' => '_collected', 'collected_at' => $now])->save();
            $topRanking = collect($rankings)->where('rank', 1)
                ->sortBy(fn (array $row) => sprintf('%s:%020d', $row['created_at'] ?? '', $row['post_id'] ?? 0))
                ->first();
            LimitLog::query()->create([
                'event' => 'collect',
                'event_id' => $event->event_id,
                'event_card_id' => $card->id,
                'actor_name' => $actor,
                'card_id' => $card->deck_id,
                'stage_id' => $card->deck?->stage_id,
                'from_state' => '_field',
                'to_state' => '_collected',
                'records_count' => count($rankings),
                'top_user_id' => $topRanking['user_id'] ?? null,
                'top_score' => isset($topRanking['score']) ? (int) $topRanking['score'] : null,
                'route' => $request?->path(),
                'ip' => $request?->ip(),
                'user_agent' => $request?->userAgent(),
                'request_id' => (string) ($request?->header('X-Request-Id') ?: Str::uuid()),
                'context' => [
                    'rankings' => collect($rankings)->map(fn ($ranking) => [
                        'user_id' => $ranking['user_id'],
                        'rank' => $ranking['rank'],
                        'rps' => $ranking['rps'],
                    ])->all(),
                    'distribution' => $distribution,
                    'taker_remainder' => $takerRemainder,
                    'holders' => $holders,
                    'final_rankings' => collect($rankings)->map(fn ($ranking) => collect($ranking)->only([
                        'post_id', 'unique_id', 'user_id', 'user_name', 'score', 'rule', 'console', 'difficulty',
                        'region', 'post_comment', 'img_url', 'video_url', 'created_at', 'rank', 'post_rank', 'rps',
                        'initial_payment_recorded',
                    ])->all())->all(),
                ],
            ]);

            return $this->payload($card->fresh('deck'), true);
        });
    }

    public function collectExpired(TrickEvent $event, string $actor = null, Request $request = null): array
    {
        $now = $this->clock->now($event);
        $deckIds = TrickEventCard::query()->where('event_id', $event->event_id)
            ->where('state', '_field')->whereNotNull('limit_at')->where('limit_at', '<=', $now)
            ->orderBy('limit_at')->pluck('deck_id');
        $collected = [];
        foreach ($deckIds as $deckId) {
            $result = $this->collect($event, (int) $deckId, false, $actor, $request);
            if ($result['collected_now']) {
                $collected[] = $result;
            }
        }

        return ['count' => count($collected), 'cards' => $collected];
    }

    private function payload(TrickEventCard $card, bool $collectedNow): array
    {
        $collectionLog = LimitLog::query()->where('event_id', $card->event_id)
            ->where('event_card_id', $card->id)->where('event', 'collect')->first();
        $finalRankings = $collectionLog?->context['final_rankings'] ?? null;

        return [
            'collected_now' => $collectedNow,
            'card' => $this->state->normalizeCard($card),
            'rankings' => is_array($finalRankings) ? $finalRankings : $this->records->rankings($card),
            'rewards' => TrickCollectionReward::query()->where('event_card_id', $card->id)->get()->all(),
            'holders' => TrickCardHolder::query()->where('event_card_id', $card->id)->pluck('player_name')->all(),
        ];
    }
}
