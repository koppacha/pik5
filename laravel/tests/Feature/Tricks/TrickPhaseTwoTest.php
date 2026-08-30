<?php

namespace Tests\Feature\Tricks;

use App\Models\Deck;
use App\Models\Player;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use App\Services\Tricks\TrickGameService;
use App\Services\Tricks\TrickStateService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\Exceptions\HttpResponseException;
use Tests\TestCase;

class TrickPhaseTwoTest extends TestCase
{
    use DatabaseTransactions;

    public function test_join_draw_take_and_read_only_snapshot_use_event_models(): void
    {
        $now = CarbonImmutable::parse('2026-07-20 12:00:00', 'Asia/Tokyo');
        $event = TrickEvent::query()->create([
            'event_id' => 990001,
            'title' => 'Phase 2 test',
            'start_at' => $now->subHour(),
            'end_at' => $now->addHours(47),
            'state' => 'active',
            'debug' => true,
            'test_mode' => true,
            'debug_now' => $now,
            'initialized_at' => $now->subHour(),
            'random_seed' => 1234,
        ]);
        foreach (range(1, 8) as $index) {
            $deck = Deck::query()->create([
                'eventId' => $event->event_id,
                'event_id' => $event->event_id,
                'stageId' => 399,
                'stage_id' => 5000 + $index,
                'origin_stage_id' => 399,
                'card_id' => 900000 + $index,
                'title' => 'Card '.$index,
                'ruleName' => 'Rule',
                'rule_name' => 'Rule',
                'state' => '_in_event',
                'text' => 'Test rule',
                'difficulty' => ($index % 5) + 1,
                'rarity' => 1,
                'rewards' => 0,
            ]);
            TrickEventCard::query()->create([
                'event_id' => $event->event_id,
                'deck_id' => $deck->id,
                'state' => '_deck',
                'difficulty' => $deck->difficulty,
            ]);
        }

        $game = app(TrickGameService::class);
        $aliceJoin = $game->join($event, 'alice');
        self::assertTrue($aliceJoin['created']);
        self::assertSame(5, $aliceJoin['player']['points']);
        self::assertSame([], $aliceJoin['hand']);
        $game->join($event, 'bob');
        self::assertSame(6, Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->value('draw_points'));
        self::assertSame(5, Player::query()->where('event_id', $event->event_id)->where('name', 'bob')->value('draw_points'));

        $game->draw($event, 'alice');
        $game->draw($event, 'alice');
        $thirdDraw = $game->draw($event, 'alice');
        self::assertSame(3, count($thirdDraw['hand']));
        self::assertSame(3, Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->value('draw_points'));

        $selectedDeckId = $thirdDraw['hand'][0]['id'];
        $take = $game->take($event, 'alice', $selectedDeckId);
        self::assertSame('_field', $take['card']['state']);
        self::assertSame(3, $take['card']['stack_count']);
        self::assertSame($now->addMinutes(90)->toIso8601String(), $take['card']['limit_at']);
        self::assertSame(2, TrickEventCard::query()->where('event_id', $event->event_id)->where('state', '_stack')->count());
        self::assertNotNull($take['player']['next_take_at']);

        $before = TrickEventCard::query()->where('event_id', $event->event_id)->pluck('state', 'id')->all();
        $snapshot = app(TrickStateService::class)->snapshot($event, 'alice');
        $after = TrickEventCard::query()->where('event_id', $event->event_id)->pluck('state', 'id')->all();
        self::assertSame($before, $after);
        self::assertSame(1, count($snapshot['field']));
        self::assertSame(0, count($snapshot['hand']));
        self::assertArrayHasKey('next_take_at', $snapshot['me']);
        self::assertNotContains('draw', collect($snapshot['logs'])->pluck('event')->all());
    }

    public function test_rule_failures_return_expected_status_and_cooldown_timestamp(): void
    {
        $now = CarbonImmutable::parse('2026-07-20 12:00:00', 'Asia/Tokyo');
        $event = TrickEvent::query()->create([
            'event_id' => 990002,
            'title' => 'Phase 2 rules',
            'start_at' => $now->subHour(),
            'end_at' => $now->addHours(47),
            'state' => 'active',
            'debug' => true,
            'test_mode' => true,
            'debug_now' => $now,
            'initialized_at' => $now->subHour(),
        ]);
        foreach (range(1, 10) as $index) {
            $deck = Deck::query()->create([
                'eventId' => $event->event_id,
                'event_id' => $event->event_id,
                'stageId' => 399,
                'stage_id' => 6000 + $index,
                'origin_stage_id' => 399,
                'card_id' => 910000 + $index,
                'title' => 'Rule card '.$index,
                'ruleName' => 'Rule',
                'rule_name' => 'Rule',
                'state' => '_in_event',
                'text' => 'Test rule',
                'difficulty' => 1,
                'rarity' => 1,
                'rewards' => 0,
            ]);
            TrickEventCard::query()->create([
                'event_id' => $event->event_id,
                'deck_id' => $deck->id,
                'state' => '_deck',
                'difficulty' => 1,
            ]);
        }
        $game = app(TrickGameService::class);
        $game->join($event, 'alice');
        $game->join($event, 'bob');
        $game->join($event, 'carol');

        Player::query()->where('event_id', $event->event_id)->where('name', 'bob')->update(['draw_points' => 0]);
        try {
            $game->draw($event, 'bob');
            self::fail('0P draw must fail');
        } catch (HttpResponseException $exception) {
            self::assertSame(422, $exception->getResponse()->getStatusCode());
        }

        $field = TrickEventCard::query()->where('event_id', $event->event_id)->where('state', '_deck')->firstOrFail();
        $field->update(['state' => '_field', 'taken_at' => $now, 'limit_at' => $now->addMinutes(90)]);
        foreach (range(1, 4) as $_) {
            $game->draw($event, 'alice');
        }
        $selected = TrickEventCard::query()->where('event_id', $event->event_id)->where('state', 'alice')->firstOrFail();
        $take = $game->take($event, 'alice', $selected->deck_id);
        self::assertSame(4, $take['card']['stack_count']);

        TrickEventCard::query()->where('event_id', $event->event_id)->where('state', '_field')->update(['state' => '_trash']);
        $newHand = TrickEventCard::query()->where('event_id', $event->event_id)->where('state', '_deck')->take(3)->get();
        TrickEventCard::query()->whereKey($newHand->pluck('id'))->update(['state' => 'alice']);
        try {
            $game->take($event, 'alice', $newHand->first()->deck_id);
            self::fail('cooldown take must fail');
        } catch (HttpResponseException $exception) {
            self::assertSame(409, $exception->getResponse()->getStatusCode());
            $payload = $exception->getResponse()->getData(true);
            self::assertSame($now->addMinutes(90)->toIso8601String(), $payload['next_take_at']);
        }
    }

    public function test_join_api_ignores_body_identity_and_accepts_signed_identity(): void
    {
        $now = CarbonImmutable::parse('2026-07-20 12:00:00', 'Asia/Tokyo');
        TrickEvent::query()->create([
            'event_id' => 990003,
            'title' => 'Phase 2 auth',
            'start_at' => $now->subHour(),
            'end_at' => $now->addHour(),
            'state' => 'active',
            'debug' => true,
            'test_mode' => true,
            'debug_now' => $now,
            'initialized_at' => $now->subHour(),
        ]);
        putenv('TRICKS_EVENT_ID=990003');
        putenv('TRICKS_INTERNAL_SECRET=phase-two-secret');
        try {
            $this->postJson('/api/tricks/join', ['userId' => 'mallory'])->assertStatus(401);

            $timestamp = (string) time();
            $signature = hash_hmac('sha256', $timestamp."\n".'alice'."\n".'0'."\n".'session'."\n", 'phase-two-secret');
            $this->withHeaders([
                'x-tricks-user' => 'alice',
                'x-tricks-role' => '0',
                'x-tricks-identity-kind' => 'session',
                'x-tricks-timestamp' => $timestamp,
                'x-tricks-signature' => $signature,
            ])->postJson('/api/tricks/join', ['userId' => 'mallory'])
                ->assertOk()
                ->assertJsonPath('player.name', 'alice')
                ->assertJsonPath('player.points', 5);
            self::assertFalse(Player::query()->where('name', 'mallory')->exists());
        } finally {
            putenv('TRICKS_EVENT_ID');
            putenv('TRICKS_INTERNAL_SECRET');
        }
    }
}
