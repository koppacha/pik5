<?php

namespace App\Services\Tricks;

use App\Models\Deck;
use App\Models\LimitLog;
use App\Models\Player;
use App\Models\TrickCardHolder;
use App\Models\TrickCollectionReward;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TrickCollectionService
{
    public function __construct(
        private readonly TrickClock $clock,
        private readonly TrickEmergencyGrantService $emergencyGrants,
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
            if ($card->state === '_collected' || ($card->state === '_trash' && $card->collected_at !== null)) {
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
            $remainderDistribution = [];
            $holders = [];
            $subsidyFlaggedHolders = [];
            $potPoints = $rankings === [] ? 0 : (int) $event->pot_points;

            if ($rankings !== []) {
                foreach ($rankings as $ranking) {
                    $player = $players->get($ranking['user_id']);
                    if ($player === null) {
                        abort(response()->json(['message' => 'ランキング参加者が大会参加者に存在しません'], 409));
                    }
                    $player->increment('rank_points', $ranking['rps']);
                }

                if (count($rankings) === 1) {
                    $distribution[$rankings[0]['user_id']] = $this->rules->totalReward(
                        (int) $card->stack_count,
                        (int) $card->paid_points_total,
                        1,
                        $potPoints,
                    );
                    $rewardType = 'single_fixed';
                } else {
                    $rankGroups = collect($rankings)->groupBy('rank')->values()
                        ->map(fn ($group) => $group->pluck('user_id')->values()->all())->all();
                    $result = $this->rewards->distribute(
                        $this->rules->totalReward(
                            (int) $card->stack_count,
                            (int) $card->paid_points_total,
                            count($rankings),
                            $potPoints,
                        ),
                        $rankGroups,
                    );
                    $distribution = $result['distribution'];
                    $lastRank = max(array_column($rankings, 'rank'));
                    $lastPlayers = collect($rankings)->where('rank', $lastRank)->pluck('user_id')->all();
                    $remainderDistribution = $this->rewards->lastPlaceRemainder(
                        (int) $result['taker_remainder'],
                        $lastPlayers,
                    );
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
                foreach ($remainderDistribution as $playerName => $points) {
                    $player = $players->get($playerName);
                    if ($player === null) {
                        abort(response()->json(['message' => '余剰還元先の最下位投稿者が存在しません'], 409));
                    }
                    $reward = TrickCollectionReward::query()->firstOrCreate([
                        'event_id' => $event->event_id,
                        'deck_id' => $card->deck_id,
                        'player_name' => $playerName,
                        'reward_type' => 'last_place_remainder',
                    ], [
                        'event_card_id' => $card->id,
                        'points_delta' => $points,
                    ]);
                    if ($reward->wasRecentlyCreated) {
                        $player->increment('draw_points', $points);
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
                if ($potPoints > 0) {
                    $event->pot_points = 0;
                    $event->save();
                }
            }

            $naturallyExpired = ! $force
                && $card->limit_at !== null
                && $now->greaterThanOrEqualTo(CarbonImmutable::instance($card->limit_at))
                && $now->lessThan($event->end_at);
            if ($naturallyExpired && $holders !== []) {
                $participantCount = Player::query()->where('event_id', $event->event_id)->count();
                foreach ($holders as $holderName) {
                    $holder = $players->get($holderName)?->fresh();
                    if ($holder === null
                        || ! $this->rules->subsidyEligible($holder->draw_points, $participantCount)) {
                        continue;
                    }
                    $holder->subsidy_flag = true;
                    $holder->subsidy_flag_slot_at = $this->nextSubsidySlot($now);
                    $holder->save();
                    $subsidyFlaggedHolders[] = $holderName;
                }
            }

            TrickEventCard::query()->where('event_id', $event->event_id)
                ->where('stack_parent_id', $card->id)->where('state', '_stack')
                ->lockForUpdate()->update(['state' => '_trash']);
            $toState = $rankings === [] ? '_trash' : '_collected';
            $card->fill(['state' => $toState, 'collected_at' => $now])->save();
            $emergencyGrant = $this->emergencyGrants->apply($event, $now, $actor, $request);
            $this->records->releaseEligibleTakeCooldowns($event, $now);
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
                'to_state' => $toState,
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
                    'pot_points_used' => $potPoints,
                    'last_place_remainder' => $remainderDistribution,
                    'recycled_unposted' => $rankings === [],
                    'emergency_grant_points' => $emergencyGrant['points'],
                    'holders' => $holders,
                    'subsidy_flagged_holders' => $subsidyFlaggedHolders,
                    'final_rankings' => collect($rankings)->map(fn ($ranking) => collect($ranking)->only([
                        'post_id', 'unique_id', 'user_id', 'user_name', 'score', 'rule', 'console', 'difficulty',
                        'region', 'post_comment', 'img_url', 'video_url', 'created_at', 'rank', 'post_rank', 'rps',
                        'provisional_reward_points', 'initial_payment_recorded',
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
            ->where('event_card_id', $card->id)->where('event', 'collect')->latest('id')->first();
        $finalRankings = $collectionLog?->context['final_rankings'] ?? null;

        return [
            'collected_now' => $collectedNow,
            'card' => $this->state->normalizeCard($card),
            'rankings' => is_array($finalRankings) ? $finalRankings : $this->records->rankings($card),
            'rewards' => TrickCollectionReward::query()->where('event_card_id', $card->id)->get()->all(),
            'holders' => TrickCardHolder::query()->where('event_card_id', $card->id)->pluck('player_name')->all(),
        ];
    }

    private function nextSubsidySlot(CarbonImmutable $now): CarbonImmutable
    {
        $base = $now->setSecond(0)->setMicrosecond(0);

        return $now->minute < 30 ? $base->setMinute(30) : $base->setMinute(0)->addHour();
    }
}
