<?php

namespace Tests\Unit\Tricks;

use App\Models\Player;
use App\Models\TrickEvent;
use App\Services\Tricks\TrickTakeCooldownService;
use Carbon\CarbonImmutable;
use Tests\TestCase;

class TrickTakeCooldownServiceTest extends TestCase
{
    public function test_fixed_cooldown_applies_before_endgame_window(): void
    {
        $now = CarbonImmutable::parse('2026-09-20 20:00:00', 'Asia/Tokyo');
        $event = $this->eventEndingAt('2026-09-20 23:59:00');
        $player = $this->playerWithLastTake($now->subMinutes(30));

        self::assertSame(
            $now->addMinutes(30)->toIso8601String(),
            (new TrickTakeCooldownService())->nextTakeAt($event, $player, $now)?->toIso8601String(),
        );
    }

    public function test_legacy_release_marker_does_not_remove_cooldown(): void
    {
        $now = CarbonImmutable::parse('2026-09-20 20:00:00', 'Asia/Tokyo');
        $event = $this->eventEndingAt('2026-09-20 23:59:00');
        $lastTake = $now->subMinutes(30);
        $player = $this->playerWithLastTake($lastTake);
        $player->take_cooldown_released_for = $lastTake;
        $cooldowns = new TrickTakeCooldownService();

        self::assertSame($now->addMinutes(30)->toIso8601String(),
            $cooldowns->nextTakeAt($event, $player, $now)?->toIso8601String());

        $player->last_take_at = $now;
        self::assertNotNull($cooldowns->nextTakeAt($event, $player, $now));
    }

    public function test_endgame_exemption_starts_exactly_one_hundred_fifty_minutes_before_end(): void
    {
        $event = $this->eventEndingAt('2026-09-20 23:59:00');
        $threshold = CarbonImmutable::parse('2026-09-20 21:29:00', 'Asia/Tokyo');
        $player = $this->playerWithLastTake($threshold->subMinutes(10));
        $cooldowns = new TrickTakeCooldownService();

        self::assertNotNull($cooldowns->nextTakeAt($event, $player, $threshold->subMicrosecond()));
        self::assertNull($cooldowns->nextTakeAt($event, $player, $threshold));
    }

    private function eventEndingAt(string $endAt): TrickEvent
    {
        return new TrickEvent([
            'end_at' => CarbonImmutable::parse($endAt, 'Asia/Tokyo'),
        ]);
    }

    private function playerWithLastTake(CarbonImmutable $lastTake): Player
    {
        return new Player([
            'last_take_at' => $lastTake,
        ]);
    }
}
