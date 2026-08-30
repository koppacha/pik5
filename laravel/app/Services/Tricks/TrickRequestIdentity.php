<?php

namespace App\Services\Tricks;

use App\Models\TrickEvent;
use Illuminate\Http\Request;

class TrickRequestIdentity
{
    private const MAX_AGE_SECONDS = 300;

    public function resolve(Request $request): ?string
    {
        return $this->verified($request)['user_id'] ?? null;
    }

    public function role(Request $request): int
    {
        return $this->verified($request)['role'] ?? 0;
    }

    public function isTest(Request $request): bool
    {
        return ($this->verified($request)['kind'] ?? null) === 'test';
    }

    public function testEventId(Request $request): ?int
    {
        $verified = $this->verified($request);

        return ($verified['kind'] ?? null) === 'test' ? (int) $verified['test_event_id'] : null;
    }

    public function resolveForEvent(Request $request, TrickEvent $event): ?string
    {
        $verified = $this->verified($request);
        if ($verified === null) {
            return null;
        }
        if ($verified['kind'] === 'test'
            && (! $event->test_mode || (int) $verified['test_event_id'] !== (int) $event->event_id)) {
            return null;
        }

        return $verified['user_id'];
    }

    /** @return array{user_id: string, role: int, kind: string, test_event_id: int}|null */
    private function verified(Request $request): ?array
    {
        $secret = (string) (getenv('TRICKS_INTERNAL_SECRET') ?: env('TRICKS_INTERNAL_SECRET', ''));
        $userId = (string) $request->header('x-tricks-user', '');
        $role = (string) $request->header('x-tricks-role', '');
        $kind = (string) $request->header('x-tricks-identity-kind', '');
        $testEventId = (string) $request->header('x-tricks-test-event', '');
        $timestamp = (string) $request->header('x-tricks-timestamp', '');
        $signature = (string) $request->header('x-tricks-signature', '');
        if ($secret === '' || $userId === '' || ! ctype_digit($role)
            || ! in_array($kind, ['session', 'test'], true)
            || ($kind === 'test' && ! ctype_digit($testEventId))
            || ! ctype_digit($timestamp) || $signature === '') {
            return null;
        }
        if (abs(time() - (int) $timestamp) > self::MAX_AGE_SECONDS) {
            return null;
        }

        $signedEventId = $kind === 'test' ? $testEventId : '';
        $expected = hash_hmac(
            'sha256',
            $timestamp."\n".$userId."\n".$role."\n".$kind."\n".$signedEventId,
            $secret,
        );

        return hash_equals($expected, $signature)
            ? [
                'user_id' => $userId,
                'role' => (int) $role,
                'kind' => $kind,
                'test_event_id' => $kind === 'test' ? (int) $testEventId : 0,
            ]
            : null;
    }
}
