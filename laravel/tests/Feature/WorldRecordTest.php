<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class WorldRecordTest extends TestCase
{
    use RefreshDatabase;

    private string $secret;
    private string|false $originalSecret;

    protected function setUp(): void
    {
        parent::setUp();
        $this->originalSecret = getenv('TRICKS_INTERNAL_SECRET');
        $this->secret = bin2hex(random_bytes(32));
        putenv('TRICKS_INTERNAL_SECRET='.$this->secret);
        Storage::fake('public');
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        foreach ([301, 316, 330, 331, 344, 345, 350, 445, 40000] as $id) {
            DB::table('stages')->insert([
                'stage_id' => $id, 'stage_code' => $id === 40000 ? '4A0' : (string) $id,
                'stage_name' => 'Synthetic', 'eng_stage_name' => 'Synthetic', 'stage_sub' => '',
                'type' => 'stage', 'display' => 'int', 'series' => $id >= 400 ? 4 : 3, 'parent' => $id >= 400 ? 48 : 31,
                'time' => 300, 'treasure' => 0, 'pikmin' => 0, 'border1' => 0, 'border2' => 0, 'border3' => 0, 'border4' => 0,
            ]);
        }
    }

    protected function tearDown(): void
    {
        putenv($this->originalSecret === false ? 'TRICKS_INTERNAL_SECRET' : 'TRICKS_INTERNAL_SECRET='.$this->originalSecret);
        parent::tearDown();
    }

    public function test_unsigned_and_out_of_scope_reports_are_rejected(): void
    {
        $this->postJson('/api/world-records', $this->payload())->assertUnauthorized();
        foreach ([[301, 41], [301, 32], [999, 31], [445, 48]] as [$stage, $rule]) {
            $this->signed([...$this->payload(), 'stage_id' => (string) $stage, 'rule' => $rule])->assertStatus(422);
        }
        $this->assertDatabaseCount('world_record_reports', 0);
    }

    public function test_holder_score_and_evidence_are_validated(): void
    {
        foreach ([['score' => 0], ['score' => 1.5], ['score' => 1000000], ['holder_name' => '  '], ['holder_name' => str_repeat('a', 101)], ['file' => UploadedFile::fake()->create('bad.txt', 1, 'text/plain')]] as $invalid) {
            $this->signed([...$this->payload(), ...$invalid])->assertStatus(422);
        }
        $this->assertDatabaseCount('world_record_reports', 0);
    }

    public function test_reporter_is_fixed_and_best_active_report_is_selected_without_normal_records(): void
    {
        $this->signed([...$this->payload(), 'reporter_user_id' => 'spoofed', 'is_active' => false])->assertCreated();
        $this->assertDatabaseHas('world_record_reports', ['reporter_user_id' => 'synthetic_reporter', 'is_active' => true]);
        $this->signed([...$this->payload(), 'score' => 200, 'holder_name' => 'Best'])->assertCreated();
        $this->signed([...$this->payload(), 'score' => 50])->assertCreated();
        $this->getJson('/api/world-records/301/31')->assertOk()->assertJsonPath('record.score', 200)->assertJsonPath('record.holder_name', 'Best');
        DB::table('world_record_reports')->where('score', 200)->update(['is_active' => false]);
        $this->getJson('/api/world-records/301/31')->assertJsonPath('record.score', 100);
        $this->assertDatabaseCount('records', 0);
        foreach ([[316, 32], [345, 33], [331, 36]] as [$stage, $rule]) {
            $this->signed([...$this->payload(), 'stage_id' => (string) $stage, 'rule' => $rule, 'platform' => $stage === 331 ? 4 : 3])->assertCreated();
            $this->getJson('/api/world-records/'.$stage.'/'.$rule)->assertOk()->assertJsonPath('record.score', 100);
        }
    }

    public function test_extended_dandori_stage_uses_its_score_order_and_common_image_storage(): void
    {
        DB::table('dandori_stages')->insert(['stage_id' => 40000, 'score_type' => 'time', 'score_order' => 'ASC', 'consoles' => '[4]']);
        $release = DB::table('dandori_releases')->insertGetId(['month' => '2026-10', 'publish_at' => '2026-10-01 00:00:00']);
        DB::table('dandori_slots')->insert(['release_id' => $release, 'position' => 1, 'stage_id' => 40000]);
        $this->travelTo(\Carbon\CarbonImmutable::parse('2026-10-20T00:00:00+09:00'));
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=');
        $this->signed([...$this->payload(), 'stage_id' => '4A0', 'rule' => 48, 'platform' => 4, 'file' => UploadedFile::fake()->createWithContent('proof.png', $png)])->assertCreated();
        $this->signed([...$this->payload(), 'stage_id' => '4A0', 'rule' => 48, 'platform' => 3])->assertStatus(422);
        $record = $this->getJson('/api/world-records/4A0/48')->assertOk()->assertJsonPath('record.score_order', 'ASC')->assertJsonPath('record.score_type', 'time')->json('record');
        Storage::disk('public')->assertExists('img/'.$record['img_url']);
        $this->get('/api/img/'.$record['img_url'])->assertOk();
        $this->signed([...$this->payload(), 'stage_id' => '4A0', 'rule' => 48, 'platform' => 4, 'score' => 50])->assertCreated();
        $this->getJson('/api/world-records/4A0/48')->assertJsonPath('record.score', 50);
        $this->withHeaders($this->headers('synthetic_admin', 10))->deleteJson('/api/world-records/'.$record['id'])->assertOk();
        Storage::disk('public')->assertExists('img/'.$record['img_url']);
    }

    private function payload(): array
    {
        return ['stage_id' => '301', 'rule' => 31, 'holder_name' => 'Synthetic Holder', 'score' => 100, 'platform' => 3];
    }

    public function test_rule_34_mixed_platform_boundaries_and_separate_bests(): void
    {
        foreach ([301, 330, 331, 344, 345, 350] as $stage) {
            foreach ([3, 4] as $platform) {
                $response = $this->signed([...$this->payload(), 'stage_id' => (string) $stage, 'rule' => 34, 'platform' => $platform]);
                if (in_array($stage, [331, 344], true) && $platform === 3) $response->assertStatus(422);
                else $response->assertCreated();
            }
            $this->getJson('/api/world-records/'.$stage.'/34')->assertJsonCount(in_array($stage, [331, 344], true) ? 1 : 2, 'records');
        }
        $this->signed([...$this->payload(), 'rule' => 34, 'score' => 200])->assertCreated();
        $this->signed([...$this->payload(), 'rule' => 34, 'platform' => 4, 'score' => 300])->assertCreated();
        $records = collect($this->getJson('/api/world-records/301/34')->json('records'))->keyBy('platform');
        $this->assertSame(200, $records[3]['score']);
        $this->assertSame(300, $records[4]['score']);
    }

    public function test_admin_soft_deletion_falls_back_and_third_deletion_blocks_only_reporter(): void
    {
        $ids = [];
        foreach ([100, 200, 300] as $score) $ids[] = $this->signed([...$this->payload(), 'score' => $score])->json('id');
        $switchId = $this->signed([...$this->payload(), 'platform' => 4, 'score' => 150])->json('id');
        $this->withHeaders($this->headers('synthetic_reporter', 0))->deleteJson('/api/world-records/'.$ids[2], ['role' => 10])->assertForbidden();
        $this->withHeaders($this->headers('synthetic_admin', 10))->deleteJson('/api/world-records/'.$ids[2])->assertOk();
        $records = collect($this->getJson('/api/world-records/301/31')->json('records'))->keyBy('platform');
        $this->assertSame(200, $records[3]['score']);
        $this->assertSame($switchId, $records[4]['id']);
        $this->assertDatabaseHas('world_record_reports', ['id' => $ids[2], 'is_active' => false, 'deleted_by' => 'synthetic_admin']);
        foreach ([$ids[2], $ids[1]] as $id) $this->withHeaders($this->headers('synthetic_admin', 10))->deleteJson('/api/world-records/'.$id)->assertOk();
        $this->withHeaders($this->headers('synthetic_reporter', 0))->getJson('/api/world-records/capabilities')->assertExactJson(['can_report' => true, 'can_delete' => false]);
        $this->signed($this->payload())->assertCreated();
        $this->withHeaders($this->headers('synthetic_admin', 10))->deleteJson('/api/world-records/'.$ids[0])->assertOk();
        $this->withHeaders($this->headers('synthetic_reporter', 0))->getJson('/api/world-records/capabilities')->assertExactJson(['can_report' => false, 'can_delete' => false]);
        $this->signed([...$this->payload(), 'stage_id' => '350', 'rule' => 34])->assertForbidden();
        $this->withHeaders($this->headers('synthetic_other', 0))->post('/api/world-records', $this->payload())->assertCreated();
        $this->withHeaders($this->headers('synthetic_admin', 10))->getJson('/api/world-records/capabilities')->assertExactJson(['can_report' => true, 'can_delete' => true]);
    }

    public function test_anonymous_cannot_delete_or_read_permissions_and_invalid_platform_is_rejected(): void
    {
        $this->deleteJson('/api/world-records/1')->assertUnauthorized();
        $this->getJson('/api/world-records/capabilities')->assertUnauthorized();
        $timestamp = (string) time();
        $testHeaders = [...$this->headers('synthetic_reporter', 10),
            'x-tricks-identity-kind' => 'test', 'x-tricks-test-event' => '1',
            'x-tricks-timestamp' => $timestamp,
            'x-tricks-signature' => hash_hmac('sha256', $timestamp."\nsynthetic_reporter\n10\ntest\n1", $this->secret),
        ];
        $this->withHeaders($testHeaders)->post('/api/world-records', $this->payload())->assertUnauthorized();
        $this->withHeaders($testHeaders)->deleteJson('/api/world-records/1')->assertUnauthorized();
        // Restore ordinary session-only headers after the test identity checks.
        $this->flushHeaders();
        foreach ([0, 1, 5, null] as $platform) $this->signed([...$this->payload(), 'platform' => $platform])->assertStatus(422);
    }

    private function headers(string $user, int $role): array
    {
        $timestamp = (string) time();
        return [
            'x-tricks-user' => $user, 'x-tricks-role' => (string) $role, 'x-tricks-identity-kind' => 'session',
            'x-tricks-timestamp' => $timestamp,
            'x-tricks-signature' => hash_hmac('sha256', $timestamp."\n".$user."\n".$role."\nsession\n", $this->secret),
            'Accept' => 'application/json',
        ];
    }

    private function signed(array $data)
    {
        return $this->withHeaders($this->headers('synthetic_reporter', 0))->post('/api/world-records', $data);
    }
}
