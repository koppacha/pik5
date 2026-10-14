<?php

namespace Tests\Feature\Tricks;

use App\Models\{Deck, Player, Record, TrickEvent, TrickEventCard, TrickCardPayment, TrickEventRecord, LimitLog};
use App\Services\Tricks\{TrickStageAllocator, TrickSubsidyService, TrickEventFinalizer, TrickRecordService, TrickStateService, TrickRequestIdentity};
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrickReleaseRegressionTest extends TestCase
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

    public function test_reserved_id_aliases_cannot_join_read_or_take_while_normal_underscore_id_can(): void
    {
        $event = $this->event();
        $card = $this->card($event, CarbonImmutable::instance($event->debug_now)->addHour());
        $card->update(['state' => '_deck', 'taker' => null, 'limit_at' => null]);
        foreach (['_deck', '_FIELD', '_stack', '_trash', '_collected', '_excluded', '_Deck ', '_déck', '＿deck'] as $name) {
            self::assertFalse(TrickRequestIdentity::isSafeUserId($name));
            // Include a pre-existing participant to prove join-only protection is insufficient.
            Player::create(['event_id' => $event->event_id, 'name' => $name, 'draw_points' => 20]);
            $this->withHeaders($this->headers($name));
            $this->postJson('/api/tricks/join?event_id=990413')->assertUnauthorized();
            $this->getJson('/api/tricks/state?event_id=990413')->assertOk()->assertJsonCount(0, 'hand');
            $this->postJson('/api/tricks/cards/'.$card->deck_id.'/take?event_id=990413')->assertUnauthorized();
            self::assertSame('_deck', $card->fresh()->state);
        }
        $this->withHeaders($this->headers('_alice'));
        $this->postJson('/api/tricks/join?event_id=990413')->assertOk();
        $this->getJson('/api/tricks/state?event_id=990413')->assertOk()->assertJsonCount(0, 'hand');
    }

    public function test_expired_and_missing_deadline_posts_roll_back_without_economy_changes(): void
    {
        $event = $this->event();
        $now = CarbonImmutable::instance($event->debug_now);
        $card = $this->card($event, $now->subSecond());
        foreach ([$now->subSecond(), $now, null] as $limit) {
            $card->update(['limit_at' => $limit]);
            $balance = Player::where('name', 'audit_slow')->value('draw_points');
            $this->postScore($card, 'audit_slow')->assertStatus(409);
            self::assertSame(0, Record::count());
            self::assertSame(0, TrickCardPayment::count());
            self::assertSame(0, TrickEventRecord::count());
            self::assertSame($balance, Player::where('name', 'audit_slow')->value('draw_points'));
            self::assertSame($limit?->getTimestamp(), $card->fresh()->limit_at?->getTimestamp());
        }
        $card->update(['limit_at' => $now->addSecond()]);
        $this->postScore($card, 'audit_slow')->assertOk();
        self::assertSame(1, Record::count());
    }

    public function test_expired_edit_preserves_previous_record_and_delete_repost_is_rejected(): void
    {
        $event = $this->event();
        $card = $this->card($event, CarbonImmutable::instance($event->debug_now)->addHour());
        $this->postScore($card, 'audit_slow')->assertOk();
        $old = Record::first();
        $card->refresh()->update(['limit_at' => CarbonImmutable::instance($event->debug_now)->subSecond()]);
        $before = $card->fresh()->toArray();
        $payments = TrickCardPayment::count();
        $this->postScore($card, 'audit_slow', ['mode' => 'edit', 'edit_unique_id' => $old->unique_id, 'score' => 999])->assertStatus(409);
        self::assertSame(1, Record::count());
        self::assertSame(123, (int) $old->fresh()->score);
        self::assertLessThan(2, (int) $old->fresh()->flg);
        self::assertSame($payments, TrickCardPayment::count());
        self::assertSame($before, $card->fresh()->toArray());
        $this->deleteJson('/api/record/'.$old->unique_id.'?user_id=audit_slow&editor_role=0')->assertOk();
        $this->postScore($card, 'audit_slow')->assertStatus(409);
        self::assertSame($payments, TrickCardPayment::count());
        self::assertSame(1, Record::count());
    }

    public function test_pre_join_slot_does_not_tax_or_consume_exemption(): void
    {
        $event = $this->event();
        $player = Player::where('name', 'audit_slow')->first();
        $player->update(['created_at' => $event->debug_now, 'draw_points' => 11, 'ranking_reset_tax_exempt' => true]);
        $subsidies = app(TrickSubsidyService::class);
        $subsidies->processCurrent($event);
        self::assertSame(11, $player->fresh()->draw_points);
        self::assertTrue($player->fresh()->ranking_reset_tax_exempt);
        $slot = CarbonImmutable::instance($event->debug_now)->setMinute(30);
        $subsidies->processSlot($event, $slot);
        self::assertSame(11, $player->fresh()->draw_points);
        self::assertFalse($player->fresh()->ranking_reset_tax_exempt);
        $subsidies->processSlot($event, $slot->addMinutes(30));
        self::assertSame(10, $player->fresh()->draw_points);
    }

    public function test_finalization_matches_earliest_deadline_pot_preview_and_id_tie_break(): void
    {
        $event = $this->event();
        $later = $this->card($event, CarbonImmutable::instance($event->debug_now)->addHours(49));
        $earlier = $this->card($event, CarbonImmutable::instance($event->debug_now)->addHours(48));
        $tie = $this->card($event, CarbonImmutable::instance($event->debug_now)->addHours(48));
        foreach ([$later, $earlier, $tie] as $card) $this->postScore($card, 'audit_fast')->assertOk();
        // Posting extensions are identical: earlier and tie still have the same deadline.
        $event->update(['pot_points' => 7]);
        $preview = app(TrickRecordService::class)->rankings($earlier->fresh())[0]['provisional_reward_points'];
        $event->update(['debug_now' => $event->end_at]);
        app(TrickEventFinalizer::class)->finalize($event->fresh());
        $logs = LimitLog::where('event', 'collect')->orderBy('id')->get();
        self::assertSame([$earlier->id, $tie->id, $later->id], $logs->pluck('event_card_id')->all());
        self::assertSame(7, $logs[0]->context['pot_points_used']);
        self::assertSame(0, $logs[1]->context['pot_points_used']);
        self::assertSame($preview, (int) \App\Models\TrickCollectionReward::where('event_card_id', $earlier->id)->sum('points_delta'));
    }

    public function test_allocator_rechecks_stale_deck_and_preserves_time_metadata_across_events(): void
    {
        $event = $this->event();
        $card = $this->card($event, CarbonImmutable::instance($event->debug_now)->addHour());
        $deck = $card->deck;
        $stale = clone $deck;
        $stale->stage_id = null;
        self::assertSame((int) $deck->stage_id, app(TrickStageAllocator::class)->ensure($event, $stale));
        $next = $deck->replicate();
        $next->event_id = 990414;
        $next->eventId = 990414;
        $next->card_id = 990414;
        $next->stage_id = null;
        $next->score_type = 'time';
        $next->save();
        $id = app(TrickStageAllocator::class)->ensure($event, $next);
        self::assertNotSame((int) $deck->stage_id, $id);
        self::assertSame('time', \Illuminate\Support\Facades\DB::table('stages')->where('stage_id', $id)->value('display'));
    }

    public function test_time_log_includes_score_type(): void
    {
        $event = $this->event();
        $card = $this->card($event, CarbonImmutable::instance($event->debug_now)->addHour());
        $card->deck->update(['score_type' => 'time']);
        $this->postScore($card, 'audit_slow', ['score' => 83])->assertOk();
        $log = collect(app(TrickStateService::class)->logs($event))->firstWhere('event', 'record_posted');
        self::assertSame('time', $log['score_type']);
        self::assertSame(83, $log['score']);
    }

    public function test_event_category_and_signed_context_lookup_preserve_private_records(): void
    {
        $event = $this->event();
        $card = $this->card($event, CarbonImmutable::instance($event->debug_now)->addHour());
        $stageId = $card->deck->stage_id;
        self::assertSame((int) $event->event_id, (int) \Illuminate\Support\Facades\DB::table('stages')->where('stage_id', $stageId)->value('parent'));
        $this->getJson('/api/stage/'.$event->event_id)->assertOk()->assertJsonPath('name', $event->title);
        $this->getJson('/api/tricks/stage-context/'.$stageId)->assertUnauthorized();
        $this->withHeaders($this->headers('audit_slow'))->getJson('/api/tricks/stage-context/'.$stageId.'?event_id=990413')
            ->assertOk()->assertJsonPath('event_id', 990413);
        $this->getJson('/api/tricks/stage-context/'.$stageId.'?event_id=990414')->assertOk()->assertJsonPath('event_id', null);
        $this->postScore($card, 'audit_slow', ['rule' => 990414])->assertStatus(422);
        $this->postScore($card, 'audit_slow', ['rule' => 990413])->assertOk();
        $record = Record::first();
        self::assertSame(990413, (int) $record->rule);
        $this->getJson('/api/record/id/'.$record->unique_id)->assertNotFound();
        $this->getJson('/api/tricks/record-context/'.$record->unique_id)->assertOk()
            ->assertJsonPath('tricks_event_id', 990413)->assertJsonMissingPath('score');
        $this->withHeaders($this->headers('audit_fast'))->getJson('/api/tricks/record-context/'.$record->unique_id)->assertForbidden();
        $this->withHeaders($this->headers('audit_slow'))->getJson('/api/tricks/record-context/invalid')->assertNotFound();
    }

    private function event(): TrickEvent
    {
        $now = CarbonImmutable::parse('2026-10-09 12:05:00', 'Asia/Tokyo');
        $event = TrickEvent::create(['event_id' => 990413, 'title' => 'Release regression', 'start_at' => $now->subHour(), 'end_at' => $now->addHours(47), 'state' => 'active', 'debug' => true, 'test_mode' => true, 'debug_now' => $now, 'initialized_at' => $now]);
        foreach (['audit_fast', 'audit_slow'] as $name) Player::create(['event_id' => 990413, 'name' => $name, 'draw_points' => 20, 'rank_points' => 0, 'card_count' => 0, 'created_at' => $now->subHour()]);
        return $event;
    }

    private function card(TrickEvent $event, CarbonImmutable $limit): TrickEventCard
    {
        $deck = Deck::create(['eventId' => $event->event_id, 'event_id' => $event->event_id, 'origin_stage_id' => 399, 'card_id' => 990413 + Deck::count(), 'title' => 'Synthetic card', 'rule_name' => 'Score', 'text' => 'Synthetic', 'difficulty' => 1, 'state' => '_in_event', 'rewards' => 0, 'score_type' => 'points']);
        app(TrickStageAllocator::class)->ensure($event, $deck);
        return TrickEventCard::create(['event_id' => $event->event_id, 'deck_id' => $deck->id, 'state' => '_field', 'rarity' => 1, 'difficulty' => 1, 'stack_count' => 3, 'taker' => 'audit_fast', 'taken_at' => $limit->subHour(), 'limit_at' => $limit])->load('deck');
    }

    private function headers(string $name): array
    {
        $ts = (string) time();
        return ['x-tricks-user' => $name, 'x-tricks-role' => '0', 'x-tricks-identity-kind' => 'session', 'x-tricks-timestamp' => $ts, 'x-tricks-signature' => hash_hmac('sha256', $ts."\n".$name."\n0\nsession\n", $this->secret)];
    }

    private function postScore(TrickEventCard $card, string $user, array $overrides = [])
    {
        return $this->withHeaders($this->headers($user))->postJson('/api/record', array_merge(['user_id' => $user, 'stage_id' => $card->deck->stage_id, 'score' => 123, 'rule' => 1, 'console' => 1, 'difficulty' => 1, 'region' => 1, 'post_comment' => 'Synthetic regression', 'user_agent' => 'phpunit', 'video_url' => '', 'mode' => 'create', 'tricks_event_id' => 990413], $overrides));
    }
}
