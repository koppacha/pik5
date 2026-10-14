<?php

namespace App\Services\Tricks;

use App\Models\Player;
use App\Models\TrickEvent;
use Carbon\CarbonImmutable;

class TrickTakeCooldownService
{
    public const COOLDOWN_MINUTES = 60;

    public const ENDGAME_FREE_MINUTES = 150;

    public function fixedCooldownEndsAt(Player $player): ?CarbonImmutable
    {
        return $player->last_take_at === null
            ? null
            : CarbonImmutable::instance($player->last_take_at)->addMinutes(self::COOLDOWN_MINUTES);
    }

    public function nextTakeAt(TrickEvent $event, Player $player, CarbonImmutable $now): ?CarbonImmutable
    {
        $fixedEnd = $this->fixedCooldownEndsAt($player);
        if ($fixedEnd === null || $now->greaterThanOrEqualTo($fixedEnd)) {
            return null;
        }
        if ($now->greaterThanOrEqualTo(
            CarbonImmutable::instance($event->end_at)->subMinutes(self::ENDGAME_FREE_MINUTES),
        )) {
            return null;
        }
        return $fixedEnd;
    }
}
