<?php

namespace Tests\Feature\Tricks;

use App\Models\Deck;
use App\Models\LimitLog;
use App\Models\Player;
use App\Models\Record;
use App\Models\TrickCardHolder;
use App\Models\TrickCollectionReward;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use App\Services\Tricks\TrickCollectionService;
use App\Services\Tricks\TrickEventFinalizer;
use App\Services\Tricks\TrickRecordService;
use App\Services\Tricks\TrickStateService;
use App\Services\Tricks\TrickSubsidyService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class TrickPhaseFourTest extends TestCase
{
    use DatabaseTransactions;

    public function test_single_player_collection_is_fixed_and_idempotent(): void
    {
        [$event, $card] = $this->fixture(['alice'], ['rarity' => 2]);
        $stack = $this->stackCard($event, $card);
        $record = $this->record($card, 'alice', 100);
        $records = app(TrickRecordService::class);
        $records->saved($record);

        $result = app(TrickCollectionService::class)->collect($event, $card->deck_id);
        self::assertTrue($result['collected_now']);
        self::assertSame(2, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('rank_points'));
        self::assertSame(13, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('draw_points'));
        self::assertSame('single_fixed', TrickCollectionReward::query()->value('reward_type'));
        self::assertSame(5, TrickCollectionReward::query()->value('points_delta'));
        self::assertSame(['alice'], TrickCardHolder::query()->pluck('player_name')->all());
        self::assertSame('_held', $card->deck->fresh()->state);
        self::assertSame('_collected', $card->fresh()->state);
        self::assertSame('_trash', $stack->fresh()->state);

        $second = app(TrickCollectionService::class)->collect($event, $card->deck_id);
        self::assertFalse($second['collected_now']);
        self::assertSame(13, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('draw_points'));
        self::assertSame(1, LimitLog::query()->where('event_id', $event->event_id)->where('event', 'collect')->count());

        $record->update(['flg' => 2]);
        $records->deleted($record->fresh());
        $third = app(TrickCollectionService::class)->collect($event, $card->deck_id);
        self::assertSame('alice', $third['rankings'][0]['user_id']);
        self::assertSame(1, $card->fresh()->post_count);
        self::assertSame('alice', $card->fresh()->top_player);
    }

    public function test_multi_player_collection_confirms_tied_ranks_and_excludes_last_place(): void
    {
        [$event, $card] = $this->fixture(['alice', 'bob', 'carol', 'dave'], [
            'rarity' => 1,
            'difficulty' => 2,
        ]);
        $records = app(TrickRecordService::class);
        foreach (['alice' => 100, 'bob' => 100, 'carol' => 80, 'dave' => 70] as $player => $score) {
            $records->saved($this->record($card, $player, $score));
        }

        app(TrickCollectionService::class)->collect($event, $card->deck_id, true);
        self::assertSame(
            ['alice' => 5, 'bob' => 5, 'carol' => 2, 'dave' => 1],
            Player::query()->where('event_id', $event->event_id)->orderBy('name')
                ->pluck('rank_points', 'name')->all(),
        );
        self::assertSame(
            ['alice' => 3, 'bob' => 3, 'carol' => 1],
            TrickCollectionReward::query()->where('reward_type', 'rank_distribution')
                ->orderBy('player_name')->pluck('points_delta', 'player_name')->all(),
        );
        self::assertSame(['alice', 'bob'], TrickCardHolder::query()->orderBy('player_name')
            ->pluck('player_name')->all());
    }

    public function test_tied_group_remainder_is_returned_to_taker(): void
    {
        [$event, $card] = $this->fixture(['alice', 'bob'], [
            'rarity' => 1,
            'difficulty' => 2,
            'stack_count' => 4,
            'taker' => 'alice',
        ]);
        $records = app(TrickRecordService::class);
        $records->saved($this->record($card, 'alice', 100));
        $records->saved($this->record($card, 'bob', 100));

        app(TrickCollectionService::class)->collect($event, $card->deck_id, true);
        self::assertSame(7, (int) TrickCollectionReward::query()->sum('points_delta'));
        self::assertSame(1, TrickCollectionReward::query()->where('reward_type', 'taker_remainder')->value('points_delta'));
        self::assertSame(13, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('draw_points'));
        self::assertSame(13, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'bob')->value('draw_points'));
    }

    public function test_subsidy_slots_are_boundary_aware_and_idempotent(): void
    {
        [$event, $card] = $this->fixture(['alice', 'bob', 'carol']);
        $createdAt = CarbonImmutable::parse('2026-07-20 08:00:00', 'Asia/Tokyo');
        Player::query()->where('event_id', $event->event_id)->update(['created_at' => $createdAt]);
        Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->update([
            'draw_points' => 5, 'subsidy_flag' => true, 'subsidy_flag_slot_at' => '2026-07-20 09:00:00',
        ]);
        Player::query()->where('event_id', $event->event_id)->where('name', 'bob')->update([
            'draw_points' => 6, 'subsidy_flag' => true, 'subsidy_flag_slot_at' => '2026-07-20 09:00:00',
        ]);
        Player::query()->where('event_id', $event->event_id)->where('name', 'carol')->update([
            'draw_points' => -2, 'subsidy_flag' => true, 'subsidy_flag_slot_at' => '2026-07-20 09:30:00',
        ]);
        $event->update(['debug_now' => '2026-07-20 09:00:00']);
        $subsidies = app(TrickSubsidyService::class);

        self::assertSame(1, $subsidies->processCurrent($event->fresh())['paid']);
        self::assertSame(0, $subsidies->processCurrent($event->fresh())['paid']);
        self::assertSame(6, Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->value('draw_points'));
        self::assertSame(-2, Player::query()->where('event_id', $event->event_id)->where('name', 'carol')->value('draw_points'));

        $event->update(['debug_now' => '2026-07-20 09:30:00']);
        self::assertSame(1, $subsidies->processCurrent($event->fresh())['paid']);
        $card->update(['state' => '_collected']);
        $event->update(['debug_now' => '2026-07-20 10:00:00']);
        self::assertSame(1, $subsidies->processCurrent($event->fresh())['paid']);
        self::assertSame(0, $subsidies->processCurrent($event->fresh())['paid']);
        self::assertSame(0, Player::query()->where('event_id', $event->event_id)->where('name', 'carol')->value('draw_points'));
    }

    public function test_empty_field_does_not_reopen_an_already_processed_subsidy_slot(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        $event->update(['debug_now' => '2026-07-20 09:00:00']);
        Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->update([
            'draw_points' => 5,
            'subsidy_flag' => false,
            'subsidy_flag_slot_at' => null,
            'created_at' => '2026-07-20 08:00:00',
        ]);
        $subsidies = app(TrickSubsidyService::class);
        self::assertSame(0, $subsidies->processCurrent($event->fresh())['paid']);

        $card->update(['state' => '_collected']);
        $event->update(['debug_now' => '2026-07-20 09:10:00']);
        self::assertSame(0, $subsidies->processCurrent($event->fresh())['paid']);
        self::assertSame(5, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('draw_points'));
    }

    public function test_event_finalization_collects_empty_field_and_releases_unheld_cards(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        app(TrickRecordService::class)->saved($this->record($card, 'alice', 100));
        $empty = $this->eventCard($event, '_field', 930003, 7203);
        $unused = $this->eventCard($event, '_deck', 930002, 7202);
        $event->update(['debug_now' => $event->end_at]);

        $result = app(TrickEventFinalizer::class)->finalize($event->fresh());
        self::assertTrue($result['ended_now']);
        self::assertSame(2, $result['collected']);
        self::assertSame('ended', $event->fresh()->state);
        self::assertSame('_collected', $card->fresh()->state);
        self::assertSame('_collected', $empty->fresh()->state);
        self::assertSame(1, TrickCardHolder::query()->where('event_id', $event->event_id)->count());
        self::assertSame(0, TrickCollectionReward::query()->where('event_card_id', $empty->id)->count());
        self::assertSame('_held', $card->deck->fresh()->state);
        self::assertSame('_eligible', $empty->deck->fresh()->state);
        self::assertSame('_eligible', $unused->deck->fresh()->state);
        $snapshot = app(TrickStateService::class)->snapshot($event->fresh(), 'alice');
        self::assertSame([], $snapshot['field']);
        self::assertSame([], $snapshot['hand']);
        self::assertSame(0, $snapshot['deck_count']);
        self::assertFalse(app(TrickEventFinalizer::class)->finalize($event->fresh())['ended_now']);
        self::assertSame(1, LimitLog::query()->where('event_id', $event->event_id)->where('event', 'event_ended')->count());
    }

    public function test_expired_collection_rejects_early_cards_and_collects_at_limit(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        $card->update(['limit_at' => $event->debug_now->addMinute()]);
        try {
            app(TrickCollectionService::class)->collect($event, $card->deck_id);
            self::fail('期限前の通常回収は拒否される必要があります');
        } catch (\Illuminate\Http\Exceptions\HttpResponseException $exception) {
            self::assertSame(422, $exception->getResponse()->getStatusCode());
        }
        self::assertSame('_field', $card->fresh()->state);

        $event->update(['debug_now' => $event->debug_now->addMinute()]);
        $result = app(TrickCollectionService::class)->collectExpired($event->fresh());
        self::assertSame(1, $result['count']);
        self::assertSame('_collected', $card->fresh()->state);
    }

    public function test_collection_apis_require_signed_admin_and_collected_is_public(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        app(TrickRecordService::class)->saved($this->record($card, 'alice', 100));
        putenv('TRICKS_EVENT_ID='.$event->event_id);
        putenv('TRICKS_INTERNAL_SECRET=phase-four-secret');
        try {
            $path = '/api/tricks/cards/'.$card->deck_id.'/collect';
            $this->postJson($path)->assertStatus(401);
            $this->withHeaders($this->signedHeaders('alice', 0))->postJson($path)->assertStatus(403);
            $this->withHeaders($this->signedHeaders('admin', 10))->postJson($path)->assertOk()
                ->assertJsonPath('collected_now', true);
            $this->getJson('/api/tricks/collected?event_id='.$event->event_id)->assertOk()
                ->assertJsonPath('0.holders.0', 'alice')
                ->assertJsonPath('0.returns_next_event', false)
                ->assertJsonPath('0.rankings.0.user_id', 'alice');
        } finally {
            putenv('TRICKS_EVENT_ID');
            putenv('TRICKS_INTERNAL_SECRET');
        }
    }

    /** @return array{0: TrickEvent, 1: TrickEventCard} */
    private function fixture(array $players, array $options = []): array
    {
        $now = CarbonImmutable::parse('2026-07-20 12:00:00', 'Asia/Tokyo');
        $event = TrickEvent::query()->create([
            'event_id' => 990201,
            'title' => 'Phase 4 test',
            'start_at' => $now->subHours(4),
            'end_at' => $now->addHours(44),
            'state' => 'active',
            'debug' => true,
            'test_mode' => true,
            'debug_now' => $now,
            'initialized_at' => $now->subHours(4),
        ]);
        foreach ($players as $name) {
            Player::query()->create([
                'event_id' => $event->event_id,
                'name' => $name,
                'draw_points' => 10,
                'rank_points' => 0,
                'card_count' => 0,
                'created_at' => $now->subHours(4),
                'updated_at' => $now->subHours(4),
            ]);
        }
        $card = $this->eventCard($event, '_field', 930001, 7201, $options);

        return [$event, $card];
    }

    private function eventCard(
        TrickEvent $event,
        string $state,
        int $cardId,
        int $stageId,
        array $options = [],
    ): TrickEventCard {
        $deck = Deck::query()->create([
            'eventId' => $event->event_id,
            'event_id' => $event->event_id,
            'stageId' => 399,
            'stage_id' => $stageId,
            'origin_stage_id' => 399,
            'card_id' => $cardId,
            'title' => 'Phase 4 card '.$cardId,
            'ruleName' => 'Rule',
            'rule_name' => 'Rule',
            'state' => '_in_event',
            'text' => 'Test rule',
            'difficulty' => $options['difficulty'] ?? 2,
            'rarity' => $options['rarity'] ?? 1,
            'rewards' => 0,
        ]);

        return TrickEventCard::query()->create([
            'event_id' => $event->event_id,
            'deck_id' => $deck->id,
            'state' => $state,
            'difficulty' => $options['difficulty'] ?? 2,
            'rarity' => $options['rarity'] ?? 1,
            'stack_count' => $options['stack_count'] ?? 3,
            'taker' => $options['taker'] ?? 'alice',
            'taken_at' => $event->debug_now,
            'limit_at' => $state === '_field' ? $event->debug_now->subMinute() : null,
        ]);
    }

    private function stackCard(TrickEvent $event, TrickEventCard $parent): TrickEventCard
    {
        $stack = $this->eventCard($event, '_stack', 930099, 7299);
        $stack->update(['stack_parent_id' => $parent->id]);

        return $stack;
    }

    private function record(TrickEventCard $card, string $userId, int $score): Record
    {
        return Record::query()->create([
            'user_id' => $userId,
            'score' => $score,
            'stage_id' => $card->deck->stage_id,
            'rule' => 1,
            'console' => 1,
            'difficulty' => $card->difficulty,
            'region' => '1',
            'team' => 0,
            'unique_id' => random_int(100000000, 999999999),
            'post_comment' => 'phase 4 test',
            'user_ip' => '127.0.0.1',
            'user_host' => 'localhost',
            'user_agent' => 'phpunit',
            'img_url' => '',
            'video_url' => '',
            'post_memo' => '',
            'flg' => 0,
        ]);
    }

    private function signedHeaders(string $userId, int $role): array
    {
        $timestamp = (string) time();

        return [
            'x-tricks-user' => $userId,
            'x-tricks-role' => (string) $role,
            'x-tricks-identity-kind' => 'session',
            'x-tricks-timestamp' => $timestamp,
            'x-tricks-signature' => hash_hmac(
                'sha256',
                $timestamp."\n".$userId."\n".$role."\n".'session'."\n",
                'phase-four-secret',
            ),
        ];
    }
}
