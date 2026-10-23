<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SecurityEventTest extends TestCase
{
    use RefreshDatabase;

    private string $secret;

    protected function setUp(): void
    {
        parent::setUp();
        $this->secret = bin2hex(random_bytes(32));
        config(['services.management_secret' => $this->secret]);
    }

    public function test_limits_are_persistent_and_isolated_by_key(): void
    {
        $payload = ['action' => 'limit', 'keys' => [hash('sha256', 'synthetic-account')], 'maximum' => 2, 'seconds' => 60];
        $this->signed('POST', $payload)->assertOk();
        $this->signed('POST', $payload)->assertOk();
        $this->signed('POST', $payload)->assertStatus(429)->assertHeader('Retry-After');
        $payload['keys'] = [hash('sha256', 'another-synthetic-account')];
        $this->signed('POST', $payload)->assertOk();
    }

    public function test_history_is_owned_by_signed_identity_and_excludes_other_users(): void
    {
        $this->signed('POST', ['action' => 'event', 'user_id' => 'owner', 'outcome' => 'success', 'ip' => '192.0.2.10', 'user_agent' => 'synthetic'])->assertOk();
        $this->signed('POST', ['action' => 'event', 'user_id' => 'other', 'outcome' => 'failure'])->assertOk();
        $this->signed('GET', [], 'owner')->assertOk()->assertJsonCount(1)->assertJsonPath('0.outcome', 'success');
        $this->signed('POST', ['action' => 'event', 'outcome' => 'success'], 'owner')->assertForbidden();
        $this->getJson('/api/security/events')->assertUnauthorized();
    }

    public function test_pruning_keeps_only_the_documented_retention_window(): void
    {
        foreach ([['success', 89], ['success', 91], ['failure', 29], ['failure', 31]] as [$outcome, $days]) {
            DB::table('login_events')->insert(['user_id' => 'synthetic', 'outcome' => $outcome, 'created_at' => now()->subDays($days)]);
        }
        $this->artisan('security:prune')->assertSuccessful();
        $this->assertDatabaseCount('login_events', 2);
    }

    public function test_unsigned_forwarded_address_cannot_override_connection_ip(): void
    {
        $this->withHeaders(['X-Client-IP' => '192.0.2.100', 'X-Client-Time' => (string) time(), 'X-Client-Signature' => 'invalid'])
            ->getJson('/api/dandori')->assertForbidden();
    }

    public function test_only_signed_foreign_traffic_is_rate_limited(): void
    {
        $timestamp = (string) time();
        $message = implode("\n", [$timestamp, 'GET', '/api/dandori', '192.0.2.10', 'US']);
        $headers = ['X-Client-IP' => '192.0.2.10', 'X-Client-Time' => $timestamp, 'X-Client-Country' => 'US',
            'X-Client-Signature' => hash_hmac('sha256', $message, $this->secret)];
        for ($i = 0; $i < 120; $i++) $this->withHeaders($headers)->getJson('/api/dandori')->assertOk();
        $this->withHeaders($headers)->getJson('/api/dandori')->assertStatus(429)->assertHeader('Retry-After', '60');
        $this->flushHeaders();
        $this->withHeaders(['X-Client-Country' => 'US'])->getJson('/api/dandori')->assertOk();
    }

    private function signed(string $method, array $data = [], string $user = 'auth-service')
    {
        $path = '/api/security/events';
        $body = $method === 'GET' ? '' : json_encode($data);
        $timestamp = (string) time();
        $nonce = bin2hex(random_bytes(16));
        $message = implode("\n", [$timestamp, $nonce, $user, '0', $method, $path, hash('sha256', $body)]);
        return $this->call($method, $path, [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_MANAGEMENT_USER' => $user, 'HTTP_X_MANAGEMENT_ROLE' => '0', 'HTTP_X_MANAGEMENT_TIME' => $timestamp,
            'HTTP_X_MANAGEMENT_NONCE' => $nonce, 'HTTP_X_MANAGEMENT_SIGNATURE' => hash_hmac('sha256', $message, $this->secret)], $body);
    }
}
