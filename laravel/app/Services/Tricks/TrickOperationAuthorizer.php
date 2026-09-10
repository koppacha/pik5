<?php

namespace App\Services\Tricks;

use App\Models\Player;
use App\Models\TrickEvent;
use Illuminate\Http\Request;

class TrickOperationAuthorizer
{
    public function __construct(private readonly TrickRequestIdentity $identity)
    {
    }

    public function assertAdmin(Request $request): string
    {
        $userId = $this->identity->resolve($request);
        if ($userId === null) {
            abort(response()->json(['message' => '認証が必要です'], 401));
        }
        if ($this->identity->role($request) < 10) {
            abort(response()->json(['message' => '管理者権限が必要です'], 403));
        }

        return $userId;
    }

    public function assertAdminForEvent(TrickEvent $event, Request $request): string
    {
        if ($this->identity->isTest($request)
            && (! $event->test_mode || $this->identity->testEventId($request) !== (int) $event->event_id)) {
            abort(response()->json(['message' => 'テスト署名は通常大会では利用できません'], 403));
        }

        return $this->assertAdmin($request);
    }

    public function assertParticipantForEvent(TrickEvent $event, Request $request): string
    {
        $userId = $this->identity->resolveForEvent($request, $event);
        if ($userId === null) {
            abort(response()->json(['message' => '認証が必要です'], 401));
        }
        if (! Player::query()->where('event_id', $event->event_id)->where('name', $userId)->exists()) {
            abort(response()->json(['message' => '大会へ参加してください'], 403));
        }

        return $userId;
    }

    public function assertFixture(Request $request, int $eventId): string
    {
        if ($this->identity->isTest($request)) {
            if ($this->identity->testEventId($request) !== $eventId || $this->identity->role($request) < 10) {
                abort(response()->json(['message' => 'fixture署名のevent_idが一致しません'], 403));
            }

            return (string) $this->identity->resolve($request);
        }

        return $this->assertAdmin($request);
    }

    public function assertDebugAdmin(TrickEvent $event, Request $request): string
    {
        if (! $event->debug && ! $event->test_mode) {
            abort(response()->json(['message' => 'デバッグ大会ではありません'], 403));
        }

        return $this->assertAdminForEvent($event, $request);
    }
}
