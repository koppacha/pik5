<?php

namespace Tests\Feature\Tricks;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class TrickRateLimitTest extends TestCase
{
    public function test_event_budget_is_separate_and_forged_identity_cannot_select_it(): void
    {
        $limiter = RateLimiter::limiter('api');
        $normal = $limiter(Request::create('/api/stage/201'));
        $guest = $limiter(Request::create('/api/tricks/state'));
        $forged = Request::create('/api/tricks/state');
        $forged->headers->set('x-tricks-user', 'codex_rate_probe');
        self::assertSame(60, $normal->maxAttempts);
        self::assertSame(60, $guest->maxAttempts);
        self::assertNotSame($normal->key, $guest->key);
        self::assertSame($guest->key, $limiter($forged)->key);
    }

    public function test_verified_users_have_individual_bounded_budgets(): void
    {
        $secret = bin2hex(random_bytes(32));
        putenv('TRICKS_INTERNAL_SECRET='.$secret);
        try {
            $limiter = RateLimiter::limiter('api');
            $keys = [];
            foreach (['codex_rate_one', 'codex_rate_two'] as $userId) {
                $request = Request::create('/api/tricks/state');
                $timestamp = (string) time();
                $request->headers->add([
                    'x-tricks-user' => $userId,
                    'x-tricks-role' => '0',
                    'x-tricks-identity-kind' => 'session',
                    'x-tricks-timestamp' => $timestamp,
                    'x-tricks-signature' => hash_hmac('sha256', $timestamp."\n".$userId."\n0\nsession\n", $secret),
                ]);
                $limit = $limiter($request);
                self::assertSame(60, $limit->maxAttempts);
                $keys[] = $limit->key;
            }
            self::assertNotSame($keys[0], $keys[1]);
        } finally {
            putenv('TRICKS_INTERNAL_SECRET');
        }
    }
}
