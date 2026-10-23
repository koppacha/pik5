<?php

namespace Tests\Feature;

use App\Services\StageCodes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DandoriManagementTest extends TestCase
{
    use RefreshDatabase;

    private string $secret;

    protected function setUp(): void
    {
        parent::setUp();
        $this->secret = bin2hex(random_bytes(32));
        config(['services.management_secret' => $this->secret]);
        $this->travelTo(\Carbon\CarbonImmutable::parse('2026-11-12T12:00:00Z'));
    }

    protected function tearDown(): void
    {

        parent::tearDown();
    }

    public function test_code_sequence_preserves_numeric_legacy_and_carries_letters(): void
    {
        $this->assertSame('499', StageCodes::next('498'));
        $this->assertSame('4A0', StageCodes::next('499'));
        $this->assertSame('4AA', StageCodes::next('4A9'));
        $this->assertSame('4B0', StageCodes::next('4AZ'));
        $this->assertSame(401, StageCodes::resolve('401'));
        $this->assertNull(StageCodes::resolve('4A0garbage'));
    }

    public function test_management_rejects_unsigned_and_unpermitted_users(): void
    {
        $this->getJson('/api/dandori/manage')->assertUnauthorized();
        $this->signed('GET', [], 'normal', 0)->assertForbidden();
    }

    public function test_admin_can_grant_and_revoke_permission_without_promoting_role(): void
    {
        $this->signed('POST', ['action' => 'grant', 'subject' => 'delegate'])->assertOk();
        $this->signed('GET', [], 'delegate', 0)->assertOk();
        $this->signed('POST', ['action' => 'grant', 'subject' => 'another'], 'delegate', 0)->assertForbidden();
        $this->signed('POST', ['action' => 'revoke', 'subject' => 'delegate'])->assertOk();
        $this->signed('GET', [], 'delegate', 0)->assertForbidden();
    }

    public function test_six_stages_publish_atomically_and_remain_hidden_as_drafts(): void
    {
        $payload = $this->batch();
        $this->signed('POST', $payload)->assertOk()->assertJsonPath('revision', 1);
        $this->getJson('/api/dandori')->assertJsonCount(0, 'stages');
        $this->getJson('/api/stage/445')->assertNotFound();
        $draft = $this->signed('GET')->json('releases.0.stages');
        $payload['stages'] = array_map(fn ($stage) => [...$stage, 'mode' => 'reuse', 'require_video' => false, 'require_image' => false], $draft);
        $payload['revision'] = 1;
        $payload['publish_at'] = '2026-11-12T00:00:00Z';
        $this->signed('POST', $payload)->assertOk();
        $this->getJson('/api/dandori')->assertJsonCount(6, 'monthly')->assertJsonCount(6, 'stages');
        $this->signed('POST', $payload)->assertStatus(409);
        $this->assertDatabaseCount('stages', 6);
        $this->assertDatabaseCount('dandori_audits', 2);
    }

    public function test_failed_batch_rolls_back_allocated_ids_and_release(): void
    {
        $payload = $this->batch();
        $payload['stages'][5]['mode'] = 'reuse';
        $payload['stages'][5]['stage_code'] = '499';
        $this->signed('POST', $payload)->assertStatus(422);
        $this->assertDatabaseCount('stages', 0);
        $this->assertDatabaseCount('dandori_releases', 0);
    }

    public function test_publishing_fewer_than_six_is_rejected(): void
    {
        $payload = $this->batch();
        array_pop($payload['stages']);
        $payload['publish_at'] = '2026-11-12T00:00:00Z';
        $this->signed('POST', $payload)->assertStatus(422);
    }

    public function test_difficulty_is_saved_for_new_and_reused_stages_and_cannot_change_after_publication(): void
    {
        DB::table('stages')->insert([...$this->stage(), 'stage_id' => 401, 'parent' => 41]);
        $payload = $this->batch();
        $payload['stages'][0] = [...$payload['stages'][0], 'mode' => 'reuse', 'stage_code' => '401', 'difficulty' => 3];
        $payload['stages'][1]['difficulty'] = 2;
        $payload['publish_at'] = '2026-11-12T00:00:00Z';
        $this->signed('POST', $payload)->assertOk();
        $this->assertDatabaseHas('stages', ['stage_id' => 401, 'parent' => 41, 'difficulty' => 3]);
        $this->getJson('/api/dandori')->assertJsonPath('monthly.0.difficulty', 3)->assertJsonPath('monthly.1.difficulty', 2);
        $this->getJson('/api/stage/401')->assertOk()->assertJsonPath('difficulty', 3);
        $payload['month'] = '2026-12';
        $payload['publish_at'] = null;
        $payload['stages'][0]['difficulty'] = 1;
        $this->signed('POST', $payload)->assertStatus(409);
        $this->assertDatabaseCount('dandori_releases', 1);
    }

    public function test_difficulty_requires_an_integer_between_one_and_three(): void
    {
        foreach ([null, 0, 4, 10, 1.5, 'invalid'] as $difficulty) {
            $payload = $this->batch();
            $payload['stages'][0]['difficulty'] = $difficulty;
            $this->signed('POST', $payload)->assertStatus(422)->assertJsonValidationErrors('stages.0.difficulty');
        }
        $this->assertDatabaseCount('stages', 0);
    }

    public function test_extended_codes_resolve_in_detail_and_record_endpoints(): void
    {
        $stage = $this->stage();
        foreach (range(445, 499) as $id) {
            DB::table('stages')->insert([...$stage, 'stage_id' => $id]);
        }
        $payload = $this->batch();
        $payload['publish_at'] = '2026-11-12T00:00:00Z';
        $this->signed('POST', $payload)->assertOk();
        $this->getJson('/api/stage/4A0')->assertOk()->assertJsonPath('stage_id', '4A0')->assertJsonPath('series', 4);
        $this->getJson('/api/record/4A0/0/48/2026/0')->assertOk();
        $this->getJson('/api/record/rank/4A0/48/100')->assertOk()->assertContent('1');
        $this->assertSame(40000, StageCodes::resolve('4a0'));
    }

    public function test_reuse_does_not_mutate_original_stage_or_duplicate_membership(): void
    {
        DB::table('stages')->insert([...$this->stage(), 'stage_id' => 401, 'parent' => 41]);
        $payload = $this->batch();
        $payload['stages'][0] = [...$payload['stages'][0], 'mode' => 'reuse', 'stage_code' => '401'];
        $payload['publish_at'] = '2026-11-12T00:00:00Z';
        $this->signed('POST', $payload)->assertOk();
        $this->assertDatabaseHas('stages', ['stage_id' => 401, 'parent' => 41]);
        $payload = $this->batch();
        $payload['month'] = '2026-12';
        $payload['stages'][0] = [...$payload['stages'][0], 'mode' => 'reuse', 'stage_code' => '401'];
        $payload['publish_at'] = '2026-12-12T00:00:00+09:00';
        $this->signed('POST', $payload)->assertOk();
        $this->assertDatabaseCount('dandori_stages', 11);
        $this->assertDatabaseCount('dandori_slots', 12);
    }

    public function test_remaining_time_ranks_descending_and_enters_only_normal_totals(): void
    {
        $payload = $this->batch();
        $payload['publish_at'] = '2026-11-12T00:00:00Z';
        $this->signed('POST', $payload)->assertOk();
        foreach ([['slow', 100], ['fast', 200], ['fast', 50]] as $index => [$user, $score]) {
            DB::table('records')->insert(['user_id' => $user, 'score' => $score, 'stage_id' => 445, 'rule' => 48,
                'console' => 4, 'difficulty' => 2, 'region' => 1, 'team' => 0, 'unique_id' => 9000000 + $index,
                'post_comment' => '', 'user_ip' => '', 'user_host' => '', 'user_agent' => 'synthetic',
                'img_url' => '', 'video_url' => '', 'post_memo' => '', 'flg' => 0,
                'created_at' => now(), 'updated_at' => now()]);
        }
        $this->getJson('/api/record/445/0/48/2026/0')->assertOk()->assertJsonPath('0.user_id', 'fast')->assertJsonPath('0.score', 200);
        $this->getJson('/api/record/rank/445/48/150')->assertOk()->assertContent('2');
        foreach ([1, 2, 40, 48] as $category) {
            $this->getJson('/api/total/'.$category.'/0/'.$category.'/2026')->assertOk()
                ->assertJsonPath('0.user_id', 'fast')->assertJsonPath('0.ranks.0.rule', 48)->assertJsonPath('0.ranks.0.score', 200);
        }
        $this->getJson('/api/total/3/0/3/2026')->assertOk()->assertExactJson([]);
        $this->getJson('/api/total/1/0/1/2025')->assertOk()->assertExactJson([]);
    }

    public function test_scheduled_release_uses_utc_boundary_and_is_not_visible_early(): void
    {
        $this->travelTo(\Carbon\CarbonImmutable::parse('2026-11-11T14:59:59Z'));
        $payload = $this->batch();
        $payload['publish_at'] = '2026-11-12T00:00:00+09:00';
        $this->signed('POST', $payload)->assertOk();
        $this->getJson('/api/dandori')->assertJsonCount(0, 'stages');
        $this->travelTo(\Carbon\CarbonImmutable::parse('2026-11-11T15:00:00Z'));
        $this->getJson('/api/dandori')->assertJsonCount(6, 'stages');
    }

    public function test_post_accepts_published_rule_48_and_rejects_other_rules_on_new_stages(): void
    {
        $payload = $this->batch();
        $payload['publish_at'] = '2026-11-12T00:00:00Z';
        $this->signed('POST', $payload)->assertOk();
        $post = ['stage_id' => '445', 'rule' => 48, 'console' => 4, 'difficulty' => 2,
            'region' => 1, 'score' => 120, 'user_id' => 'synthetic', 'user_agent' => 'synthetic',
            'post_comment' => '', 'video_url' => '', 'mode' => 'create'];
        $this->postJson('/api/record', $post)->assertOk();
        $this->assertDatabaseHas('records', ['stage_id' => 445, 'rule' => 48, 'score' => 120]);
        $post['rule'] = 41;
        $this->postJson('/api/record', $post)->assertStatus(422);
        $post['rule'] = 48;
        $post['stage_id'] = 499;
        $this->postJson('/api/record', $post)->assertStatus(422);
    }

    public function test_certification_is_stored_only_in_memo_and_survives_editing_without_exposing_the_memo(): void
    {
        $batch = $this->batch();
        $batch['publish_at'] = '2026-11-12T00:00:00Z';
        $this->signed('POST', $batch)->assertOk();
        $post = ['stage_id' => '445', 'rule' => 48, 'console' => 4, 'difficulty' => 2, 'region' => 1,
            'score' => 120, 'user_id' => 'synthetic', 'user_agent' => 'synthetic', 'certified' => true,
            'post_comment' => '', 'video_url' => '', 'mode' => 'create'];
        $this->postJson('/api/record', $post)->assertOk();
        $row = DB::table('records')->where('stage_id', 445)->first();
        $this->assertTrue(\App\Services\RecordCertification::isCertified(48, $row->post_memo));
        $response = $this->getJson('/api/record/445/0/48/2026/0')->assertJsonPath('0.is_certified', true);
        $this->assertArrayNotHasKey('post_memo', $response->json('0'));
        $post = [...$post, 'mode' => 'edit', 'edit_unique_id' => $row->unique_id, 'editor_role' => 10];
        unset($post['certified']);
        $this->postJson('/api/record', $post)->assertOk();
        $this->getJson('/api/record/id/'.$row->unique_id)->assertJsonPath('is_certified', true);
        $post['certified'] = false;
        $this->postJson('/api/record', $post)->assertOk();
        $this->getJson('/api/record/id/'.$row->unique_id)->assertJsonPath('is_certified', false);
        $memo = DB::table('records')->where('unique_id', $row->unique_id)->value('post_memo');
        $this->assertStringContainsString('edited_from:', $memo);
        $this->assertFalse(\App\Services\RecordCertification::isCertified(41, \App\Services\RecordCertification::MARKER));
    }

    private function batch(): array
    {
        return ['month' => '2026-11', 'revision' => 0, 'publish_at' => null, 'stages' => array_map(fn ($i) => [
            'mode' => 'new', 'stage_name' => 'Synthetic '.$i, 'eng_stage_name' => '', 'stage_sub' => '',
            'score_type' => 'time', 'score_order' => 'DESC', 'total_base' => 600, 'consoles' => [4],
            'require_video' => false, 'require_image' => false, 'difficulty' => 1,
            'time' => 300, 'treasure' => 0, 'pikmin' => 0, 'border1' => 0, 'border2' => 0, 'border3' => 0, 'border4' => 0,
        ], range(1, 6))];
    }

    private function stage(): array
    {
        return ['stage_name' => 'Synthetic', 'eng_stage_name' => 'Synthetic', 'stage_sub' => '',
            'type' => 'stage', 'display' => 'time', 'series' => 4, 'parent' => 48,
            'time' => 300, 'treasure' => 0, 'pikmin' => 0, 'border1' => 0, 'border2' => 0, 'border3' => 0, 'border4' => 0];
    }

    private function signed(string $method, array $data = [], string $user = 'admin', int $role = 10)
    {
        $path = '/api/dandori/manage';
        $body = $method === 'GET' ? '' : json_encode($data);
        $timestamp = (string) time();
        $nonce = bin2hex(random_bytes(16));
        $signature = hash_hmac('sha256', implode("\n", [$timestamp, $nonce, $user, (string) $role, $method, $path, hash('sha256', $body)]), $this->secret);
        return $this->call($method, $path, [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_MANAGEMENT_USER' => $user, 'HTTP_X_MANAGEMENT_ROLE' => (string) $role,
            'HTTP_X_MANAGEMENT_TIME' => $timestamp, 'HTTP_X_MANAGEMENT_NONCE' => $nonce, 'HTTP_X_MANAGEMENT_SIGNATURE' => $signature], $body);
    }
}
