<?php
namespace Tests\Feature\Tricks;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class TrickReplayTest extends TestCase
{
    use RefreshDatabase;
    private string $previousStorage;
    private string $fixtureStorage;

    protected function setUp(): void
    {
        parent::setUp();
        CarbonImmutable::setTestNow('2026-10-12 12:00:00');
        $this->previousStorage = storage_path();
        $this->fixtureStorage = sys_get_temp_dir().'/tricks-replay-test-'.bin2hex(random_bytes(8));
        $this->app->useStoragePath($this->fixtureStorage);
        $directory = storage_path('app/tricks/replay/990099');
        File::ensureDirectoryExists($directory);
        $deck = ['id'=>901, 'card_id'=>901, 'card_key'=>'990099-001', 'origin_stage_id'=>399, 'stage_id'=>1901, 'title'=>'Synthetic replay', 'rule_name'=>'Score', 'text'=>'Before ruling', 'difficulty'=>1, 'creator'=>'Synthetic', 'score_type'=>'points', 'score_order'=>'desc'];
        $card = ['id'=>41, 'deck_id'=>901, 'event_id'=>990099, 'state'=>'_field', 'difficulty'=>1, 'rarity'=>1, 'stack_count'=>2, 'taker'=>'replay_test', 'top_player'=>null, 'post_count'=>1, 'paid_points_total'=>0, 'limit_at'=>'2026-10-09 21:00:00', 'taken_at'=>'2026-10-09 20:00:00', 'collected_at'=>null, 'stack_parent_id'=>null, 'drawn_order'=>1, 'draw_count'=>1, 'returned_count'=>0, 'late_first_extension'=>false, 'deck'=>$deck];
        $record = ['post_id'=>1, 'unique_id'=>123456789, 'user_id'=>'replay_test', 'created_at'=>'2026-10-09 20:00:00', 'event_card_id'=>41, 'score'=>42, 'active'=>true];
        $state = ['cards'=>['41'=>$card], 'players'=>['replay_test'=>['name'=>'replay_test', 'draw_points'=>10, 'rank_points'=>0, 'take_count'=>1, 'last_take_at'=>'2026-10-09 20:00:00', 'created_at'=>'2026-10-09 20:00:00']], 'records'=>['1'=>$record], 'holders'=>[], 'rewards'=>[], 'final_rankings'=>[], 'pot_points'=>0, 'draw_total'=>2, 'take_total'=>1, 'ended'=>false];
        $card['deck']['text'] = 'After ruling';
        $record['active'] = false;
        $this->save('checkpoint-000.json.gz', $state);
        $this->save('frames.json.gz', [
            ['at'=>'2026-10-09T20:01:00+09:00', 'patch'=>['maps'=>['cards'=>['41'=>$card]], 'values'=>[]]],
            ['at'=>'2026-10-09T20:02:00+09:00', 'patch'=>['maps'=>['records'=>['1'=>$record]], 'values'=>[]]],
        ]);
        $this->save('catalog.json.gz', ['metadata'=>['123456789'=>['unique_id'=>123456789, 'console'=>1, 'post_comment'=>'Archive comment', 'video_url'=>'', 'img_url'=>'', 'updated_at'=>'2026-10-09 20:00:00']], 'public_logs'=>[]]);
        $this->save('manifest.json', ['version'=>1, 'event_id'=>990099, 'title'=>'Synthetic replay', 'start_at'=>'2026-10-09T20:00:00+09:00', 'end_at'=>'2026-10-11T19:59:00+09:00', 'ended_at'=>'2026-10-11T19:59:00+09:00', 'published_at'=>'2026-10-11T20:00:00+09:00', 'checkpoints'=>[['at'=>'2026-10-09T20:00:00+09:00','cursor'=>0,'file'=>'checkpoint-000.json.gz']], 'timeline'=>[['at'=>'2026-10-09T20:00:00+09:00','cursor'=>0],['at'=>'2026-10-09T20:01:00+09:00','cursor'=>1],['at'=>'2026-10-09T20:02:00+09:00','cursor'=>2]], 'additions'=>[]]);
    }

    private function save(string $file, array $value): void
    {
        $text = json_encode($value, JSON_THROW_ON_ERROR);
        file_put_contents(storage_path('app/tricks/replay/990099/'.$file), str_ends_with($file, '.gz') ? gzencode($text) : $text);
    }

    protected function tearDown(): void
    {
        $this->app->useStoragePath($this->previousStorage);
        File::deleteDirectory($this->fixtureStorage);
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_rulings_and_resets_are_historical_but_evidence_is_latest(): void
    {
        DB::table('records')->insert(['post_id'=>1, 'unique_id'=>123456789, 'user_id'=>'replay_test', 'stage_id'=>1901, 'score'=>999, 'rule'=>990099, 'console'=>2, 'difficulty'=>0, 'region'=>1, 'flg'=>0, 'post_comment'=>'Latest evidence', 'video_url'=>'https://example.invalid/latest', 'img_url'=>'synthetic.png', 'user_ip'=>'192.0.2.1', 'user_host'=>'example.invalid', 'user_agent'=>'Synthetic', 'post_memo'=>'', 'team'=>'', 'created_at'=>'2026-10-09 20:00:00', 'updated_at'=>'2026-10-12 10:00:00']);
        $before = $this->getJson('/api/tricks/replay/990099/snapshot?frame=0')->assertOk();
        $before->assertJsonPath('read_only', true)->assertJsonPath('tournament.available', false)
            ->assertJsonPath('field.0.text', 'Before ruling')->assertJsonPath('field.0.rankings.0.score', 42)
            ->assertJsonPath('field.0.rankings.0.post_comment', 'Latest evidence')
            ->assertJsonPath('field.0.rankings.0.console', 2)->assertJsonPath('field.0.rankings.0.video_url', 'https://example.invalid/latest');
        self::assertStringNotContainsString('192.0.2.1', $before->getContent());
        $this->getJson('/api/tricks/replay/990099/snapshot?frame=1')->assertOk()->assertJsonPath('field.0.text', 'After ruling')->assertJsonCount(1, 'field.0.rankings');
        $this->getJson('/api/tricks/replay/990099/snapshot?frame=2')->assertOk()->assertJsonCount(0, 'field.0.rankings')->assertJsonPath('post_total', 0);
        self::assertSame(999, (int) DB::table('records')->where('post_id',1)->value('score'));
        self::assertSame(1, DB::table('records')->count());
    }

    public function test_unposted_fund_is_displayed_but_not_distributed(): void
    {
        $this->getJson('/api/tricks/replay/990099/snapshot?frame=2')->assertOk()
            ->assertJsonPath('field.0.live_total_reward', 2)
            ->assertJsonPath('field.0.provisional_total_reward', 0)
            ->assertJsonPath('field.0.provisional_taker_remainder', 0)
            ->assertJsonPath('points_total', 12);
    }

    public function test_timeline_keeps_the_same_public_log_payload_as_snapshot(): void
    {
        $catalog = json_decode(gzdecode(file_get_contents(storage_path('app/tricks/replay/990099/catalog.json.gz'))), true);
        $catalog['public_logs'] = [
            ['cursor'=>1, 'log'=>['id'=>11,'event_card_id'=>41,'event'=>'record_posted','actor_name'=>'replay_test','card_title'=>'Synthetic replay','rule_name'=>'Score','score'=>42,'score_type'=>'points','rank'=>1,'created_at'=>'2026-10-09T20:01:00+09:00']],
        ];
        $this->save('catalog.json.gz', $catalog);
        $index = $this->getJson('/api/tricks/replay/990099')->assertOk();
        $snapshot = $this->getJson('/api/tricks/replay/990099/snapshot?frame=1')->assertOk();
        foreach ($index->json('timeline.1.log') as $key => $value) self::assertSame($value, $snapshot->json('logs.0.'.$key));
    }

    public function test_bounded_batches_match_single_snapshots_and_keep_rulings(): void
    {
        $batch = $this->getJson('/api/tricks/replay/990099/snapshots?mode=frame&start=0&count=8')->assertOk()->assertJsonCount(3, 'snapshots');
        foreach ($batch->json('snapshots') as $index => $snapshot) {
            self::assertSame($this->getJson("/api/tricks/replay/990099/snapshot?frame={$index}")->assertOk()->json(), $snapshot);
        }
        $this->getJson('/api/tricks/replay/990099/snapshots?mode=checkpoint&start=0&count=1')->assertOk()->assertJsonCount(1, 'snapshots');
        foreach (['mode=frame&start=0&count=9', 'mode=frame&start=-1&count=1', 'mode=frame&start=3&count=1', 'mode=other&start=0&count=1', 'mode=frame&start=0&count=0'] as $query) {
            $this->getJson('/api/tricks/replay/990099/snapshots?'.$query)->assertStatus(422);
        }
        $this->postJson('/api/tricks/replay/990099/snapshots')->assertStatus(405);
        CarbonImmutable::setTestNow('2026-10-11 19:59:59');
        $this->getJson('/api/tricks/replay/990099/snapshots?mode=frame&start=0&count=1')->assertForbidden();
    }

    public function test_publication_unknown_cursors_and_read_only_routes(): void
    {
        $index = $this->getJson('/api/tricks/replay/990099')->assertOk();
        self::assertArrayNotHasKey('file', $index->json('checkpoints.0'));
        $this->getJson('/api/tricks/replay/990099/snapshot?frame=-1')->assertStatus(422);
        $this->getJson('/api/tricks/replay/990099/snapshot?frame=3')->assertStatus(422);
        $this->getJson('/api/tricks/replay/990099/snapshot?checkpoint=10')->assertStatus(422);
        $this->getJson('/api/tricks/replay/990099/snapshot?frame=1&checkpoint=0')->assertStatus(422);
        $this->getJson('/api/tricks/replay/990098')->assertNotFound();
        $this->postJson('/api/tricks/replay/990099/snapshot')->assertStatus(405);
        CarbonImmutable::setTestNow('2026-10-11 19:59:59');
        $this->getJson('/api/tricks/replay/990099')->assertForbidden();
        $this->getJson('/api/tricks/replay/990099/snapshot?frame=0')->assertForbidden();
    }
}
