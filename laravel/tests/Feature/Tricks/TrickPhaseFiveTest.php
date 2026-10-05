<?php

namespace Tests\Feature\Tricks;

use App\Models\Deck;
use App\Models\Player;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use App\Services\Tricks\TrickDebugTimeService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrickPhaseFiveTest extends TestCase
{
    use RefreshDatabase;

    public function test_debug_advance_processes_intermediate_subsidy_expiry_and_event_end(): void
    {
        [$event, $card] = $this->fixture(true);
        $result = app(TrickDebugTimeService::class)->advance($event, 30 * 60, 'admin');

        self::assertSame(1, $result['collected']);
        self::assertSame(1, $result['subsidy_paid']);
        self::assertSame('_collected', $card->fresh()->state);
        self::assertSame(6, Player::query()->where('event_id', $event->event_id)->value('draw_points'));

        $ended = app(TrickDebugTimeService::class)->advance($event->fresh(), 4 * 3600, 'admin');
        self::assertTrue($ended['ended']);
        self::assertSame('ended', $event->fresh()->state);
        self::assertSame('_eligible', $card->deck->fresh()->state);
    }

    public function test_debug_time_api_requires_debug_admin_and_rejects_rewind(): void
    {
        [$event] = $this->fixture(true);
        putenv('TRICKS_EVENT_ID='.$event->event_id);
        putenv('TRICKS_INTERNAL_SECRET=phase-five-secret');
        try {
            $path = '/api/tricks/debug/time/advance';
            $this->postJson($path, ['minutes' => 1])->assertStatus(401);
            $this->withHeaders($this->signedHeaders('alice', 0))->postJson($path, ['minutes' => 1])->assertStatus(403);
            $this->withHeaders($this->signedHeaders('admin', 10))->postJson($path, ['minutes' => 1])
                ->assertOk()->assertJsonPath('frozen', true);
            $this->withHeaders($this->signedHeaders('admin', 10))->postJson('/api/tricks/debug/time/set', [
                'now' => '2026-07-20T08:00:00+09:00',
            ])->assertStatus(422);

            $event->update(['debug' => false, 'test_mode' => false, 'debug_now' => null]);
            $this->withHeaders($this->signedHeaders('admin', 10))->postJson($path, ['minutes' => 1])->assertStatus(403);
        } finally {
            putenv('TRICKS_EVENT_ID');
            putenv('TRICKS_INTERNAL_SECRET');
        }
    }

    /** @return array{0: TrickEvent, 1: TrickEventCard} */
    private function fixture(bool $debug): array
    {
        $now = CarbonImmutable::parse('2026-07-20 08:50:00', 'Asia/Tokyo');
        $event = TrickEvent::query()->create([
            'event_id' => 990301,
            'title' => 'Phase 5 test',
            'start_at' => $now->subMinutes(50),
            'end_at' => $now->addHours(3)->addMinutes(10),
            'state' => 'active',
            'debug' => $debug,
            'test_mode' => false,
            'debug_now' => $debug ? $now : null,
            'initialized_at' => $now->subMinutes(50),
        ]);
        Player::query()->create([
            'event_id' => $event->event_id,
            'name' => 'alice',
            'draw_points' => 5,
            'rank_points' => 0,
            'card_count' => 0,
            'subsidy_flag' => true,
            'subsidy_flag_slot_at' => '2026-07-20 09:00:00',
            'created_at' => $now->subMinutes(50),
            'updated_at' => $now->subMinutes(50),
        ]);
        $deck = Deck::query()->create([
            'eventId' => $event->event_id,
            'event_id' => $event->event_id,
            'stage_id' => 7301,
            'origin_stage_id' => 399,
            'card_id' => 940001,
            'title' => 'Phase 5 card',
            'rule_name' => 'Rule',
            'state' => '_in_event',
            'text' => 'Test rule',
            'difficulty' => 1,
            'rewards' => 0,
        ]);
        $card = TrickEventCard::query()->create([
            'event_id' => $event->event_id,
            'deck_id' => $deck->id,
            'state' => '_field',
            'difficulty' => 1,
            'rarity' => 1,
            'stack_count' => 3,
            'taker' => 'alice',
            'taken_at' => $now->subMinutes(85),
            'limit_at' => '2026-07-20 09:05:00',
        ]);

        return [$event, $card];
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
                'phase-five-secret',
            ),
        ];
    }
}
