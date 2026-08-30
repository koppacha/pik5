<?php

namespace Tests\Unit\Tricks;

use App\Services\Tricks\TrickRequestIdentity;
use Illuminate\Http\Request;
use PHPUnit\Framework\TestCase;

class TrickRequestIdentityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        putenv('TRICKS_INTERNAL_SECRET=test-secret');
    }

    protected function tearDown(): void
    {
        putenv('TRICKS_INTERNAL_SECRET');
        parent::tearDown();
    }

    public function test_valid_signature_resolves_user(): void
    {
        $timestamp = (string) time();
        $signature = hash_hmac('sha256', $timestamp."\n".'alice'."\n".'10'."\n".'session'."\n", 'test-secret');
        $request = Request::create('/', 'POST', [], [], [], [
            'HTTP_X_TRICKS_USER' => 'alice',
            'HTTP_X_TRICKS_ROLE' => '10',
            'HTTP_X_TRICKS_IDENTITY_KIND' => 'session',
            'HTTP_X_TRICKS_TIMESTAMP' => $timestamp,
            'HTTP_X_TRICKS_SIGNATURE' => $signature,
        ]);

        self::assertSame('alice', (new TrickRequestIdentity())->resolve($request));
        self::assertSame(10, (new TrickRequestIdentity())->role($request));
    }

    public function test_body_user_id_and_invalid_signature_are_ignored(): void
    {
        $request = Request::create('/', 'POST', ['userId' => 'mallory'], [], [], [
            'HTTP_X_TRICKS_USER' => 'alice',
            'HTTP_X_TRICKS_TIMESTAMP' => (string) time(),
            'HTTP_X_TRICKS_SIGNATURE' => 'invalid',
        ]);

        self::assertNull((new TrickRequestIdentity())->resolve($request));
    }
}
