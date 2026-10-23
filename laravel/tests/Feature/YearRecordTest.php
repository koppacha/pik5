<?php

namespace Tests\Feature;

use App\Services\YearRecords;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class YearRecordTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelTo(CarbonImmutable::parse('2026-10-19 12:00:00', 'Asia/Tokyo'));
        Cache::flush();
        $this->stage(101, 10);
        $this->stage(201, 21);
    }

    private function stage(int $id, int $parent, string $display = 'points'): void
    {
        DB::table('stages')->insert([
            'stage_id' => $id, 'stage_name' => 'Synthetic '.$id, 'eng_stage_name' => 'Synthetic '.$id,
            'stage_sub' => '', 'type' => 'challenge', 'display' => $display, 'series' => 1, 'parent' => $parent,
            'time' => 300, 'treasure' => 0, 'pikmin' => 0, 'border1' => 0, 'border2' => 0, 'border3' => 0, 'border4' => 0,
        ]);
    }

    private function record(string $user, int $score, string $date, int $stage = 101, int $rule = 10, string $video = ''): int
    {
        return DB::table('records')->insertGetId([
            'user_id' => $user, 'score' => $score, 'stage_id' => $stage, 'rule' => $rule,
            'console' => 1, 'difficulty' => 2, 'region' => '1', 'team' => 0,
            'unique_id' => random_int(100000000, 999999999), 'post_comment' => '',
            'user_ip' => '', 'user_host' => '', 'user_agent' => 'synthetic-year-test',
            'img_url' => '', 'video_url' => $video, 'post_memo' => '', 'flg' => '0',
            'created_at' => $date, 'updated_at' => $date,
        ]);
    }

    public function test_years_and_malformed_parameters_are_rejected(): void
    {
        foreach (['2013', '2027', '2025x', '02025', '2025.0', '-2025'] as $year) {
            $this->getJson('/api/date/'.$year)->assertNotFound();
        }
        $this->getJson('/api/date/2014')->assertOk()->assertJsonCount(0, 'categories.normal');
    }

    public function test_2014_includes_earlier_records_and_honours_japan_year_end(): void
    {
        $this->record('synthetic-old', 100, '2013-06-01 00:00:00');
        $this->record('synthetic-boundary', 200, '2014-12-31 23:59:59');
        $this->record('synthetic-future', 300, '2015-01-01 00:00:00');
        $this->getJson('/api/date/2014')->assertOk()->assertJsonCount(2, 'categories.normal')
            ->assertJsonPath('categories.normal.0.user_id', 'synthetic-boundary')
            ->assertJsonPath('categories.normal.0.created_at', '2014-12-31T23:59:59+09:00');
    }

    public function test_yearly_results_equal_stage_rankings_before_display_year_filter(): void
    {
        $this->record('synthetic-old', 500, '2024-01-01 00:00:00');
        $best = $this->record('synthetic-new', 200, '2025-02-01 00:00:00');
        $this->record('synthetic-new', 100, '2025-12-31 23:59:59');
        $this->record('synthetic-new', 800, '2026-01-01 00:00:00');
        $this->record('synthetic-more', 400, '2025-03-01 00:00:00', 201, 21);
        $stage = collect($this->getJson('/api/record/101/0/10/2025/0')->assertOk()->json())->keyBy('post_id');
        $year = collect($this->getJson('/api/date/2025')->assertOk()->json('categories.normal'))->keyBy('post_id');
        self::assertCount(2, $year);
        self::assertSame(2, $year[$best]['post_rank']);
        self::assertSame($stage[$best]['rps'], $year[$best]['rps']);
        self::assertFalse($year->contains('user_id', 'synthetic-old'));
    }

    public function test_video_filter_does_not_resurrect_an_older_score(): void
    {
        $this->record('synthetic-a', 100, '2025-01-01 00:00:00', 101, 10, 'https://example.com/video');
        $best = $this->record('synthetic-a', 200, '2025-02-01 00:00:00');
        $this->getJson('/api/date/2025')->assertOk()->assertJsonCount(1, 'categories.normal')
            ->assertJsonPath('categories.normal.0.post_id', $best)->assertJsonPath('categories.normal.0.video_url', '');
    }

    public function test_categories_ties_and_zero_score_are_preserved(): void
    {
        $this->stage(1001, 151101);
        $first = $this->record('synthetic-a', 100, '2025-01-01 00:00:00');
        $this->record('synthetic-b', 100, '2025-01-02 00:00:00');
        $this->record('synthetic-c', 0, '2025-01-03 00:00:00');
        $this->record('synthetic-a', 100, '2025-01-01 00:00:00', 101, 11);
        $this->record('synthetic-a', 100, '2025-01-01 00:00:00', 101, 27);
        $this->record('synthetic-a', 100, '2025-01-01 00:00:00', 1001, 151101);
        $response = $this->getJson('/api/date/2025')->assertOk();
        $response->assertJsonCount(3, 'categories.normal')->assertJsonCount(2, 'categories.special')->assertJsonCount(1, 'categories.limited')
            ->assertJsonPath('categories.normal.0.post_id', $first)->assertJsonPath('categories.normal.0.post_rank', 1)
            ->assertJsonPath('categories.normal.1.post_rank', 1)->assertJsonPath('categories.normal.2.post_rank', 3);
        $rps = array_column($response->json('categories.normal'), 'rps');
        self::assertGreaterThanOrEqual($rps[2], $rps[1]);
    }

    public function test_current_year_uses_now_and_keeps_stages_rules_separate(): void
    {
        $this->record('synthetic-a', 100, '2026-10-19 12:00:00');
        $this->record('synthetic-a', 200, '2026-10-19 12:00:01');
        $this->record('synthetic-a', 200, '2026-10-19 12:00:00', 201, 21);
        $this->record('synthetic-a', 100, '2026-10-19 12:00:00', 101, 11);
        $this->getJson('/api/date/2026')->assertOk()->assertJsonCount(2, 'categories.normal')
            ->assertJsonCount(1, 'categories.special')->assertJsonPath('categories.normal.0.score', 100)
            ->assertJsonPath('asOf', '2026-10-19T12:00:00+09:00');
    }

    public function test_past_cache_is_stable_and_can_be_explicitly_invalidated(): void
    {
        $this->record('synthetic-a', 100, '2023-06-01 00:00:00');
        $this->getJson('/api/date/2023')->assertJsonCount(1, 'categories.normal');
        $this->record('synthetic-b', 200, '2023-06-01 00:00:00');
        $this->getJson('/api/date/2023')->assertJsonCount(1, 'categories.normal');
        app(YearRecords::class)->forget(2023);
        $this->getJson('/api/date/2023')->assertJsonCount(2, 'categories.normal');
        $this->postJson('/api/date/2023/refresh')->assertUnauthorized();
    }

    public function test_public_event_release_changes_the_past_year_cache_without_exposing_active_records(): void
    {
        $this->stage(1002, 991008, 'time');
        $post = $this->record('synthetic-event', 100, '2025-06-01 00:00:00', 1002, 1);
        $now = CarbonImmutable::now('Asia/Tokyo');
        $event = \App\Models\TrickEvent::create([
            'event_id' => 991008, 'title' => 'Synthetic year event', 'start_at' => $now->subHour(),
            'end_at' => $now->addHour(), 'state' => 'active',
        ]);
        $deck = \App\Models\Deck::create([
            'eventId' => 991008, 'event_id' => 991008, 'stage_id' => 1002, 'origin_stage_id' => 101,
            'card_id' => 1002, 'title' => 'Synthetic event', 'rule_name' => 'Synthetic card rule',
            'state' => '_in_event', 'text' => 'Synthetic', 'difficulty' => 1, 'rewards' => 0,
        ]);
        $card = \App\Models\TrickEventCard::create([
            'event_id' => 991008, 'deck_id' => $deck->id, 'state' => '_field', 'difficulty' => 1, 'rarity' => 1,
        ]);
        \App\Models\TrickEventRecord::create([
            'event_id' => 991008, 'event_card_id' => $card->id, 'deck_id' => $deck->id, 'record_id' => $post,
        ]);
        $this->getJson('/api/date/2025')->assertOk()->assertJsonCount(0, 'categories.limited');
        $this->travelTo($event->end_at);
        $this->getJson('/api/date/2025')->assertOk()->assertJsonCount(1, 'categories.limited')
            ->assertJsonPath('categories.limited.0.event_rule_name', 'Synthetic card rule')
            ->assertJsonPath('categories.limited.0.score_type', 'time');
    }

    public function test_refresh_requires_a_signed_current_administrator_identity(): void
    {
        config(['services.management_secret' => 'synthetic-year-refresh-secret']);
        foreach ([2 => 403, 10 => 200] as $role => $status) {
            $timestamp = (string) time();
            $nonce = bin2hex(random_bytes(16));
            $body = '{}';
            $path = '/api/date/2025/refresh';
            $message = implode("\n", [$timestamp, $nonce, 'synthetic-admin', (string) $role, 'POST', $path, hash('sha256', $body)]);
            $this->call('POST', $path, [], [], [], [
                'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json',
                'HTTP_X_MANAGEMENT_USER' => 'synthetic-admin', 'HTTP_X_MANAGEMENT_ROLE' => (string) $role,
                'HTTP_X_MANAGEMENT_TIME' => $timestamp, 'HTTP_X_MANAGEMENT_NONCE' => $nonce,
                'HTTP_X_MANAGEMENT_SIGNATURE' => hash_hmac('sha256', $message, 'synthetic-year-refresh-secret'),
            ], $body)->assertStatus($status);
        }
    }

    public function test_published_dandori_uses_public_code_and_configured_score_direction(): void
    {
        $this->stage(445, 48, 'time');
        DB::table('stages')->where('stage_id', 445)->update(['stage_code' => '4A0']);
        DB::table('dandori_stages')->insert([
            'stage_id' => 445, 'score_type' => 'time', 'score_order' => 'ASC', 'total_base' => 600, 'consoles' => '[1]',
        ]);
        $release = DB::table('dandori_releases')->insertGetId([
            'month' => '2026-10', 'revision' => 1, 'publish_at' => '2026-10-19 03:00:00',
        ]);
        DB::table('dandori_slots')->insert(['release_id' => $release, 'position' => 1, 'stage_id' => 445]);
        $best = $this->record('synthetic-a', 100, '2026-10-19 12:00:00', 445, 48);
        $this->record('synthetic-a', 200, '2026-10-19 12:00:00', 445, 48);
        $this->getJson('/api/date/2026')->assertOk()->assertJsonCount(1, 'categories.normal')
            ->assertJsonPath('categories.normal.0.post_id', $best)->assertJsonPath('categories.normal.0.stage_code', '4A0')
            ->assertJsonPath('categories.normal.0.score_type', 'time');
    }

    public function test_unpublished_dandori_and_invalidated_rows_are_excluded(): void
    {
        $this->stage(445, 48, 'time');
        $this->record('synthetic-hidden', 100, '2026-10-01 00:00:00', 445, 48);
        $invalid = $this->record('synthetic-invalid', 100, '2026-10-01 00:00:00');
        DB::table('records')->where('post_id', $invalid)->update(['flg' => '2']);
        $this->getJson('/api/date/2026')->assertOk()->assertJsonCount(0, 'categories.normal');
    }
}
