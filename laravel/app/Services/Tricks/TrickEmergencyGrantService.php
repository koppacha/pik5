<?php

namespace App\Services\Tricks;

use App\Models\LimitLog;
use App\Models\Player;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TrickEmergencyGrantService
{
    public function apply(
        TrickEvent $event,
        CarbonImmutable $now,
        ?string $actor = null,
        ?Request $request = null,
    ): array {
        if (TrickEventCard::query()->where('event_id', $event->event_id)->where('state', '_field')->exists()) {
            return ['points' => 0, 'grants' => []];
        }

        $players = Player::query()->where('event_id', $event->event_id)
            ->orderBy('id')->lockForUpdate()->get();
        if ($players->isEmpty() || $players->contains(
            fn (Player $player): bool => $player->draw_points + $player->card_count >= 3,
        )) {
            return ['points' => 0, 'grants' => []];
        }

        $grants = [];
        foreach ($players as $player) {
            $amount = 3 - ($player->draw_points + $player->card_count);
            $player->increment('draw_points', $amount);
            $grants[$player->name] = $amount;
        }
        $total = array_sum($grants);
        LimitLog::query()->create([
            'event' => 'empty_field_floor_grant',
            'event_id' => $event->event_id,
            'actor_name' => $actor,
            'points_delta' => $total,
            'route' => $request?->path(),
            'ip' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'request_id' => (string) ($request?->header('X-Request-Id') ?: Str::uuid()),
            'context' => [
                'grants' => $grants,
                'total_points' => $total,
                'resource_floor' => 3,
                'granted_at' => $now->toIso8601String(),
            ],
        ]);

        return ['points' => $total, 'grants' => $grants];
    }
}
