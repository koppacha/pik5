<?php

namespace Tests\Feature\Tricks;

use App\Models\{Deck, Player, Record, TrickEvent, TrickEventCard, TrickCardPayment, TrickEventRecord, LimitLog};
use App\Services\Tricks\{TrickStageAllocator, TrickSubsidyService, TrickEventFinalizer, TrickRecordService, TrickStateService, TrickRequestIdentity};
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrickClosureTest extends TestCase
{
    use RefreshDatabase;

    private string $secret;

    protected function setUp(): void
    {
        parent::setUp();
        $this->secret = bin2hex(random_bytes(32));
        putenv('TRICKS_INTERNAL_SECRET='.$this->secret);
    }

    protected function tearDown(): void
    {
        putenv('TRICKS_INTERNAL_SECRET');
        parent::tearDown();
    }

    public function test_closure_release_edits_and_frozen_results(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');
        $now = CarbonImmutable::parse('2026-10-09 20:30:00', 'Asia/Tokyo');
        CarbonImmutable::setTestNow($now);
        try {
            $event = $this->event();
            $card = $this->card($event, $now->addDays(3));
            $empty = $this->card($event, $now->addDays(3));
            $emptySecond = $this->card($event, $now->addDays(3));
            $this->postScore($card, 'audit_fast', ['rule' => 261009])->assertOk();
            $original = Record::first();
            $original->created_at = $now;
            $original->save();
            $event->update(['pot_points' => 7]);
            CarbonImmutable::setTestNow('2026-10-11 19:59:00');
            app(TrickEventFinalizer::class)->finalize($event->fresh());
            $this->getJson('/api/record/id/'.$original->unique_id)->assertNotFound();
            $catalog = app(\App\Services\Tricks\TrickHolderCatalog::class);
            self::assertSame([], $catalog->cardsFor('audit_fast', app(TrickStateService::class), app(TrickRecordService::class)));
            self::assertArrayNotHasKey('audit_fast', $catalog->counts());
            CarbonImmutable::setTestNow('2026-10-11 19:59:59');
            $this->getJson('/api/record/id/'.$original->unique_id)->assertNotFound();
            CarbonImmutable::setTestNow('2026-10-11 20:00:00');
            $this->getJson('/api/record/id/'.$original->unique_id)->assertOk()->assertJsonPath('metadata_only_edit', true);
            self::assertCount(1, $catalog->cardsFor('audit_fast', app(TrickStateService::class), app(TrickRecordService::class)));
            self::assertSame(1, $catalog->counts()['audit_fast']);
            $collected = $this->getJson('/api/tricks/collected?event_id=261009')->assertOk()->json();
            self::assertCount(3, $collected);
            self::assertSame([$card->deck->stage_id, $empty->deck->stage_id, $emptySecond->deck->stage_id], array_column($collected, 'stage_id'));
            self::assertSame($card->deck->stage_id, $collected[0]['stage_id']);
            self::assertSame(11, $collected[0]['total_reward_points']); // Rarity 1 reward 4 plus pot 7.
            $this->getJson('/api/record/audit_fast/0/261009/2026/1')->assertOk()->assertJsonPath('0.post_id', $original->post_id);
            $this->getJson('/api/record/audit_fast/0/1/2026/1')->assertOk()->assertExactJson([]);
            $frozen = $card->fresh()->toArray();
            $payments = TrickCardPayment::count();
            $rewards = \App\Models\TrickCollectionReward::count();
            foreach (['audit_fast' => 0, 'closure_admin' => 10] as $actor => $role) {
                $this->withHeaders($this->headers($actor, $role));
                $this->getJson('/api/tricks/record-context/'.$original->unique_id)->assertOk()->assertJsonPath('metadata_only_edit', true);
                $this->post('/api/record', [
                    'user_id' => $actor, 'editor_role' => $role, 'mode' => 'edit', 'edit_unique_id' => $original->unique_id,
                    'stage_id' => $original->stage_id, 'score' => $original->score, 'rule' => 261009,
                    'console' => 2, 'difficulty' => 1, 'region' => 1, 'post_comment' => 'Closure evidence',
                    'video_url' => 'https://example.invalid/evidence', 'user_agent' => 'phpunit',
                    'file' => \Illuminate\Http\UploadedFile::fake()->create('proof.png', 1, 'image/png'),
                ])->assertOk();
                $updated = Record::where('unique_id', $original->unique_id)->where('flg', '<', 2)->firstOrFail();
                self::assertSame('audit_fast', $updated->user_id);
                self::assertSame($original->created_at->getTimestamp(), $updated->created_at->getTimestamp());
                self::assertSame('Closure evidence', $updated->post_comment);
                self::assertSame('https://example.invalid/evidence', $updated->video_url);
                self::assertNotEmpty($updated->img_url);
                \Illuminate\Support\Facades\Storage::disk('public')->assertExists('img/'.$updated->img_url);
                self::assertSame(2, (int) $updated->console);
                self::assertSame(1, TrickEventRecord::where('record_id', $updated->post_id)->count());
            }
            self::assertSame($frozen, $card->fresh()->toArray());
            self::assertSame($payments, TrickCardPayment::count());
            self::assertSame($rewards, \App\Models\TrickCollectionReward::count());
            $this->withHeaders($this->headers('audit_slow', 1))->getJson('/api/tricks/record-context/'.$original->unique_id)->assertForbidden();
            $this->postScore($card, 'audit_slow', ['mode' => 'edit', 'edit_unique_id' => $original->unique_id, 'rule' => 261009])->assertForbidden();
            $this->postScore($card, 'audit_fast', ['mode' => 'edit', 'edit_unique_id' => $original->unique_id, 'rule' => 261009, 'score' => 999])->assertStatus(422);
            $this->postScore($card, 'audit_fast', ['rule' => 261009])->assertForbidden();
        } finally {
            CarbonImmutable::setTestNow();
        }
    }

    public function test_collected_order_uses_valid_record_count_instead_of_game_counter(): void
    {
        CarbonImmutable::setTestNow('2026-10-09 20:30:00');
        try {
            $event = $this->event();
            $first = $this->card($event, CarbonImmutable::now()->addDays(3));
            $second = $this->card($event, CarbonImmutable::now()->addDays(3));
            $this->postScore($first, 'audit_fast', ['rule' => 261009])->assertOk();
            $this->postScore($second, 'audit_fast', ['rule' => 261009])->assertOk();
            $this->postScore($second, 'audit_fast', ['rule' => 261009, 'score' => 124])->assertOk();
            CarbonImmutable::setTestNow('2026-10-11 20:00:00');
            app(TrickEventFinalizer::class)->finalize($event->fresh());
            $first->refresh()->update(['post_count' => 99]);
            $second->refresh()->update(['post_count' => 1]);
            $result = $this->getJson('/api/tricks/collected?event_id=261009')->assertOk()->json();
            self::assertSame([$second->deck->stage_id, $first->deck->stage_id], array_column($result, 'stage_id'));
            self::assertSame([2, 1], array_column($result, 'post_count'));
            self::assertSame(99, $first->fresh()->post_count);
        } finally {
            CarbonImmutable::setTestNow();
        }
    }

    private function event(): TrickEvent
    {
        $now = CarbonImmutable::parse('2026-10-09 12:05:00', 'Asia/Tokyo');
        $event = TrickEvent::create(['event_id' => 261009, 'title' => '第19回期間限定ランキング', 'start_at' => $now->subHour(), 'end_at' => CarbonImmutable::parse('2026-10-11 19:59:00', 'Asia/Tokyo'), 'state' => 'active', 'debug' => false, 'test_mode' => false, 'debug_now' => $now, 'initialized_at' => $now]);
        foreach (['audit_fast', 'audit_slow'] as $name) Player::create(['event_id' => 261009, 'name' => $name, 'draw_points' => 20, 'rank_points' => 0, 'card_count' => 0, 'created_at' => $now->subHour()]);
        return $event;
    }

    private function card(TrickEvent $event, CarbonImmutable $limit): TrickEventCard
    {
        $deck = Deck::create(['eventId' => $event->event_id, 'event_id' => $event->event_id, 'origin_stage_id' => 399, 'card_id' => 261009 + Deck::count(), 'title' => 'Synthetic card', 'rule_name' => 'Score', 'text' => 'Synthetic', 'difficulty' => 1, 'state' => '_in_event', 'rewards' => 0, 'score_type' => 'points']);
        app(TrickStageAllocator::class)->ensure($event, $deck);
        return TrickEventCard::create(['event_id' => $event->event_id, 'deck_id' => $deck->id, 'state' => '_field', 'rarity' => 1, 'difficulty' => 1, 'stack_count' => 3, 'taker' => 'audit_fast', 'taken_at' => $limit->subHour(), 'limit_at' => $limit])->load('deck');
    }

    private function headers(string $name, int $role = 0): array
    {
        $ts = (string) time();
        return ['x-tricks-user' => $name, 'x-tricks-role' => (string) $role, 'x-tricks-identity-kind' => 'session', 'x-tricks-timestamp' => $ts, 'x-tricks-signature' => hash_hmac('sha256', $ts."\n".$name."\n".$role."\nsession\n", $this->secret)];
    }

    private function postScore(TrickEventCard $card, string $user, array $overrides = [])
    {
        return $this->withHeaders($this->headers($user))->postJson('/api/record', array_merge(['user_id' => $user, 'stage_id' => $card->deck->stage_id, 'score' => 123, 'rule' => 1, 'console' => 1, 'difficulty' => 1, 'region' => 1, 'post_comment' => 'Synthetic regression', 'user_agent' => 'phpunit', 'video_url' => '', 'mode' => 'create', 'tricks_event_id' => 261009], $overrides));
    }
}
