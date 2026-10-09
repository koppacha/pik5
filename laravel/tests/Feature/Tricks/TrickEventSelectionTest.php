<?php

namespace Tests\Feature\Tricks;

use App\Models\TrickEvent;
use App\Models\Player;
use App\Services\Tricks\TrickEventResolver;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrickEventSelectionTest extends TestCase
{
    use RefreshDatabase;

    public function test_current_prefers_live_event_then_nearest_upcoming_then_latest_result(): void
    {
        $now = CarbonImmutable::parse('2026-10-06 12:00:00', 'Asia/Tokyo');
        CarbonImmutable::setTestNow($now);
        try {
            $old = $this->event(880001, $now->subDays(3), $now->subDays(2), 'ended');
            $latest = $this->event(880002, $now->subDays(2), $now->subDay(), 'ended');
            self::assertSame($latest->event_id, app(TrickEventResolver::class)->current()->event_id);
            $future = $this->event(880003, $now->addDays(3), $now->addDays(4));
            $next = $this->event(880004, $now->addDay(), $now->addDays(2));
            self::assertSame($next->event_id, app(TrickEventResolver::class)->current()->event_id);
            $live = $this->event(880005, $now->subHour(), $now->addHour(), 'active');
            // 期限を過ぎたactive行や環境設定で開催中の選択を上書きしない
            $expired = $this->event(880006, $now->subHours(3), $now->subHours(2), 'active');
            putenv('TRICKS_EVENT_ID='.$future->event_id);
            self::assertSame($live->event_id, app(TrickEventResolver::class)->current()->event_id);
            $this->getJson('/api/tricks/state')->assertOk()->assertJsonPath('tournament.event_id', $live->event_id);
        } finally {
            putenv('TRICKS_EVENT_ID');
            CarbonImmutable::setTestNow();
        }
    }

    public function test_explicit_event_is_used_for_state_results_and_authenticated_operations(): void
    {
        $now = CarbonImmutable::parse('2026-10-06 12:00:00', 'Asia/Tokyo');
        CarbonImmutable::setTestNow($now);
        putenv('TRICKS_INTERNAL_SECRET=event-selection-test-only');
        try {
            $live = $this->event(880010, $now->subHour(), $now->addHour(), 'active');
            $selected = $this->event(880011, $now->subHours(2), $now->addHour(), 'active');
            $ended = $this->event(880012, $now->subDays(2), $now->subDay(), 'ended');
            $this->getJson('/api/tricks/state?event_id='.$selected->event_id)->assertOk()->assertJsonPath('tournament.event_id', $selected->event_id);
            $this->getJson('/api/tricks/state?event_id='.$ended->event_id)->assertOk()->assertJsonPath('tournament.state', 'ended');
            $this->getJson('/api/tricks/collected?event_id='.$ended->event_id)->assertOk();
            $timestamp = (string) time();
            $headers = [
                'x-tricks-user' => 'event-selection-player', 'x-tricks-role' => '0',
                'x-tricks-identity-kind' => 'session', 'x-tricks-timestamp' => $timestamp,
                'x-tricks-signature' => hash_hmac('sha256', $timestamp."\nevent-selection-player\n0\nsession\n", 'event-selection-test-only'),
            ];
            $this->withHeaders($headers)->postJson('/api/tricks/join?event_id='.$selected->event_id)->assertOk();
            self::assertTrue(Player::where('event_id', $selected->event_id)->where('name', 'event-selection-player')->exists());
            self::assertFalse(Player::where('event_id', $live->event_id)->where('name', 'event-selection-player')->exists());
            $this->getJson('/api/tricks/tournament?event_id='.$selected->event_id)->assertOk()->assertJsonPath('participant_count', 1);
            $this->postJson('/api/tricks/join?event_id='.$ended->event_id)->assertStatus(403);
            $this->getJson('/api/tricks/state?event_id=99999999')->assertNotFound();
            $this->getJson('/api/tricks/state?event_id=invalid')->assertStatus(422);
        } finally {
            putenv('TRICKS_INTERNAL_SECRET');
            CarbonImmutable::setTestNow();
        }
    }

    private function event(int $id, CarbonImmutable $start, CarbonImmutable $end, string $state = 'scheduled'): TrickEvent
    {
        return TrickEvent::create(['event_id' => $id, 'title' => 'Selection test '.$id,
            'start_at' => $start, 'end_at' => $end, 'state' => $state, 'initialized_at' => $start]);
    }
}
