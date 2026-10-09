<?php

namespace Tests\Feature\Tricks;

use App\Models\Deck;
use App\Models\Record;
use App\Models\Stage;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use App\Models\TrickEventRecord;
use App\Services\Tricks\TrickRecordService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrickRecordVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_routes_hide_event_records_but_count_them_and_release_at_exact_end(): void
    {
        $now = CarbonImmutable::now()->startOfSecond();
        CarbonImmutable::setTestNow($now);
        try {
            [$event, $card] = $this->fixture($now, 399);
            $baseline = $this->record(399, 10, $now->subHours(2), 10);
            $hidden = $this->record(399, 10, $now, 200);
            $unlinked = $this->record(399, 10, $now, 100);
            $this->link($event, $card, $hidden);
            [, $limitedCard] = $this->fixture($now, 1101, $event);
            $limited = $this->record(1101, 1, $now, 300);
            $this->link($event, $limitedCard, $limited);
            $hiddenIds = [$hidden->post_id, $unlinked->post_id, $limited->post_id];
            $year = date('Y');
            $routes = [
                '/api/record', '/api/new', '/api/new?after_post_id='.$baseline->post_id,
                "/api/record/399/1/10/$year/1", "/api/record/visibility_test/1/10/$year/1",
                '/api/record/history/399/10/visibility_test',
                "/api/record/1101/1/0/$year/1", "/api/record/visibility_test/1/1/$year/1",
            ];
            foreach ($routes as $route) {
                $response = $this->getJson($route)->assertOk();
                self::assertSame([], array_values(array_intersect($hiddenIds, array_column($response->json(), 'post_id'))), $route);
            }
            $this->getJson('/api/record/id/'.$hidden->unique_id)->assertNotFound();
            $this->getJson('/api/record/top/399/1/10/1')->assertJsonPath('post_id', $baseline->post_id);
            self::assertSame(1, $this->getJson('/api/record/rank/399/10/50')->assertOk()->json());
            $this->getJson('/api/stage/399')->assertJsonPath('count', 1)->assertJsonPath('member', 1);
            $this->getJson('/api/prev')->assertJsonPath('stage.cnt', 1)->assertJsonPath('posts', 4);
            $this->getJson('/api/trend')->assertJsonPath('0.cnt', 1);
            $this->getJson('/api/count')->assertJsonPath('0.cnt', 4);
            // Event reads are deliberately unrestricted by the public scope.
            self::assertSame($hidden->post_id, app(TrickRecordService::class)->rankings($card)[0]['post_id']);
            $privateCacheKey = Record::publicVisibilityCacheKey();
            CarbonImmutable::setTestNow($event->end_at->copy()->subSecond());
            $this->getJson('/api/record/id/'.$hidden->unique_id)->assertNotFound();
            CarbonImmutable::setTestNow($event->end_at);
            self::assertSame('active', $event->fresh()->state); // finalizer has not run
            self::assertNotSame($privateCacheKey, Record::publicVisibilityCacheKey());
            $this->getJson('/api/record/id/'.$hidden->unique_id)->assertOk()->assertJsonPath('post_id', $hidden->post_id);
            $this->getJson('/api/record/top/399/1/10/1')->assertJsonPath('post_id', $hidden->post_id);
            $this->getJson('/api/stage/399')->assertJsonPath('count', 3);
            $this->getJson('/api/prev')->assertJsonPath('stage.cnt', 3)->assertJsonPath('posts', 4);
            $this->getJson('/api/trend')->assertJsonPath('0.cnt', 3);
            $this->getJson('/api/count')->assertJsonPath('0.cnt', 4);
            $this->getJson("/api/record/1101/1/0/$year/1")->assertOk()->assertJsonPath('0.post_id', $limited->post_id);
            $allUserRecords = $this->getJson("/api/record/visibility_test/1/1/$year/1")->assertOk()->json();
            self::assertContains($limited->post_id, array_column($allUserRecords, 'post_id'));
            $released = $this->getJson('/api/new')->assertOk()->json();
            foreach ($hiddenIds as $id) self::assertContains($id, array_column($released, 'post_id'));
            foreach (["/api/record/399/1/10/$year/1", "/api/record/visibility_test/1/10/$year/1"] as $route) {
                $this->getJson($route)->assertOk()->assertJsonPath('0.post_id', $hidden->post_id);
            }
        } finally {
            CarbonImmutable::setTestNow();
        }
    }

    public function test_debug_clock_and_links_with_backdated_records_are_respected(): void
    {
        $now = CarbonImmutable::now()->startOfSecond();
        [$event, $card] = $this->fixture($now, 1101);
        $event->update(['test_mode' => true, 'debug_now' => $now]);
        $backdated = $this->record(1101, 1, $now->subDays(2), 100);
        $this->link($event, $card, $backdated);
        $historical = $this->record(1101, 1, $now->subDays(3), 50);
        $atStart = $this->record(1101, 1, CarbonImmutable::instance($event->start_at), 60);
        $atEnd = $this->record(1101, 1, CarbonImmutable::instance($event->end_at), 70);
        self::assertSame([$historical->post_id, $atEnd->post_id], Record::publiclyVisible()->orderBy('post_id')->pluck('post_id')->all());
        $this->getJson('/api/record/id/'.$backdated->unique_id)->assertNotFound();
        $event->update(['debug_now' => $event->start_at->copy()->subSecond()]);
        self::assertSame(4, Record::publiclyVisible()->count());
        $event->update(['debug_now' => $event->start_at]);
        self::assertSame(2, Record::publiclyVisible()->count());
        $event->update(['debug_now' => $event->end_at]);
        self::assertSame(4, Record::publiclyVisible()->count());
    }

    public function test_snapshot_post_total_excludes_deleted_and_unlinked_records_even_after_closure(): void
    {
        $now = CarbonImmutable::now()->startOfSecond();
        [$event, $card] = $this->fixture($now, 1101);
        $event->update(['debug' => true, 'test_mode' => true, 'debug_now' => $now]);
        $visible = $this->record(1101, 1, $now, 100);
        $this->link($event, $card, $visible);
        $history = $this->record(1101, 1, $now, 90);
        $history->update(['flg' => 1]);
        $this->link($event, $card, $history);
        $deleted = $this->record(1101, 1, $now, 80);
        $deleted->update(['flg' => 2]);
        $this->link($event, $card, $deleted);
        $this->record(1101, 1, $now, 70); // Same stage but not an event submission.
        $other = TrickEvent::create([
            'event_id' => 991009, 'title' => 'Other event', 'state' => 'active',
            'start_at' => $now->subHour(), 'end_at' => $now->addHour(),
        ]);
        [, $otherCard] = $this->fixture($now, 1102, $other);
        $this->link($other, $otherCard, $this->record(1102, 1, $now, 60));
        $state = app(\App\Services\Tricks\TrickStateService::class);
        self::assertSame(2, $state->snapshot($event->fresh(), null)['post_total']);
        $visible->update(['flg' => 2]);
        self::assertSame(1, $state->snapshot($event->fresh(), null)['post_total']);
        $event->update(['state' => 'ended']);
        self::assertSame(1, $state->snapshot($event->fresh(), null)['post_total']);
    }

    private function fixture(CarbonImmutable $now, int $stageId, ?TrickEvent $event = null): array
    {
        $event ??= TrickEvent::create([
            'event_id' => 991008, 'title' => 'Visibility test',
            'start_at' => $now->subHour(), 'end_at' => $now->addHour(), 'state' => 'active',
        ]);
        (new Stage)->forceFill([
            'stage_id' => $stageId, 'stage_name' => 'Visibility test', 'eng_stage_name' => 'Test',
            'stage_sub' => '', 'type' => 'challenge', 'display' => '1', 'series' => 1,
            'parent' => $stageId < 1000 ? 10 : 1, 'time' => 0, 'treasure' => 0, 'pikmin' => 0,
            'border1' => 0, 'border2' => 0, 'border3' => 0, 'border4' => 0,
        ])->save();
        $deck = Deck::create([
            'eventId' => $event->event_id, 'event_id' => $event->event_id,
            'stage_id' => $stageId, 'origin_stage_id' => 399, 'card_id' => $stageId,
            'title' => 'Visibility test', 'rule_name' => 'Test', 'state' => '_in_event',
            'text' => 'Test', 'difficulty' => 1, 'rewards' => 0,
        ]);
        $card = TrickEventCard::create([
            'event_id' => $event->event_id, 'deck_id' => $deck->id, 'state' => '_field',
            'difficulty' => 1, 'rarity' => 1,
        ]);
        return [$event, $card];
    }

    private function record(int $stageId, int $rule, CarbonImmutable $createdAt, int $score): Record
    {
        $record = new Record;
        $record->forceFill([
            'user_id' => 'visibility_test', 'score' => $score, 'stage_id' => $stageId, 'rule' => $rule,
            'console' => 1, 'difficulty' => 1, 'region' => '1', 'team' => 0,
            'unique_id' => random_int(100000000, 399999999), 'post_comment' => 'Synthetic visibility test',
            'user_ip' => '127.0.0.1', 'user_host' => 'localhost', 'user_agent' => 'phpunit',
            'img_url' => '', 'video_url' => '', 'post_memo' => '', 'flg' => 0, 'created_at' => $createdAt,
        ])->save();
        return $record;
    }

    private function link(TrickEvent $event, TrickEventCard $card, Record $record): void
    {
        TrickEventRecord::create([
            'event_id' => $event->event_id, 'event_card_id' => $card->id,
            'deck_id' => $card->deck_id, 'record_id' => $record->post_id,
        ]);
    }
}
