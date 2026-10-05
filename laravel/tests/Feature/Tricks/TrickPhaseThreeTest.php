<?php

namespace Tests\Feature\Tricks;

use App\Models\Deck;
use App\Models\LimitLog;
use App\Models\Player;
use App\Models\Record;
use App\Models\TrickCardPayment;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use App\Models\TrickEventRecord;
use App\Services\Tricks\TrickGameService;
use App\Services\Tricks\TrickRecordService;
use App\Services\Tricks\TrickStateService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrickPhaseThreeTest extends TestCase
{
    use RefreshDatabase;

    private string $testSecret;

    protected function setUp(): void
    {
        parent::setUp();
        $this->testSecret = bin2hex(random_bytes(32));
        putenv('TRICKS_EVENT_ID=990101');
        putenv('TRICKS_INTERNAL_SECRET='.$this->testSecret);
    }

    protected function tearDown(): void
    {
        putenv('TRICKS_EVENT_ID');
        putenv('TRICKS_INTERNAL_SECRET');
        parent::tearDown();
    }

    public function test_post_extensions_and_posting_badges_survive_delete_and_repost(): void
    {
        [$event, $card] = $this->fixture();
        $card->update(['limit_at' => $event->debug_now->addMinutes(44)]);
        $records = app(TrickRecordService::class);
        $first = $this->record($card, 'alice', 100);
        $records->saved($first);
        self::assertFalse($card->fresh()->late_first_extension);
        self::assertTrue($card->fresh()->limit_at->equalTo($event->debug_now->addMinutes(59)));
        $state = app(TrickStateService::class);
        self::assertTrue($state->snapshot($event, 'alice')['field'][0]['my_has_record']);
        self::assertFalse($state->snapshot($event, 'bob')['field'][0]['my_has_record']);
        self::assertSame(0, $state->snapshot($event, 'bob')['field'][0]['my_initial_post_cost']);
        self::assertFalse($state->snapshot($event, null)['field'][0]['my_can_post']);
        $records->saved($this->record($card, 'bob', 90));
        self::assertTrue($card->fresh()->limit_at->equalTo($event->debug_now->addMinutes(69)));
        $records->saved($this->record($card, 'carol', 80));
        self::assertTrue($card->fresh()->limit_at->equalTo($event->debug_now->addMinutes(79)));
        self::assertSame(0, $state->snapshot($event, 'dave')['field'][0]['my_initial_post_cost']);
        $first->update(['flg' => 2]);
        $records->deleted($first->fresh());
        self::assertFalse($state->snapshot($event, 'alice')['field'][0]['my_has_record']);
        self::assertSame(2, $state->snapshot($event, 'alice')['field'][0]['my_initial_post_cost']);
        $records->saved($this->record($card, 'alice', 110));
        self::assertTrue($card->fresh()->limit_at->equalTo($event->debug_now->addMinutes(79)));
        self::assertFalse($card->fresh()->late_first_extension);
    }

    public function test_first_and_later_posts_extend_even_in_last_hour(): void
    {
        [$event, $card] = $this->fixture();
        $card->update(['limit_at' => $event->debug_now->addMinutes(45)]);
        app(TrickRecordService::class)->saved($this->record($card, 'alice', 100));
        self::assertFalse($card->fresh()->late_first_extension);
        self::assertTrue($card->fresh()->limit_at->equalTo($event->debug_now->addMinutes(60)));
        $event->update(['debug_now' => $event->end_at->subHour()]);
        $card->update(['limit_at' => $event->debug_now->addMinutes(20)]);
        app(TrickRecordService::class)->saved($this->record($card, 'bob', 90));
        self::assertTrue($card->fresh()->limit_at->equalTo($event->debug_now->addMinutes(30)));
    }

    public function test_first_post_in_final_hour_uses_the_normal_extension_policy(): void
    {
        [$event, $card] = $this->fixture();
        $event->update(['debug_now' => $event->end_at->subHour()]);
        $card->update(['limit_at' => $event->debug_now->addMinutes(20)]);
        app(TrickRecordService::class)->saved($this->record($card, 'alice', 100));
        self::assertFalse($card->fresh()->late_first_extension);
        self::assertTrue($card->fresh()->limit_at->equalTo($event->debug_now->addMinutes(35)));
    }

    public function test_initial_posts_charge_extend_rank_and_update_provisional_points(): void
    {
        [$event, $card] = $this->fixture();
        $records = app(TrickRecordService::class);
        foreach (['alice' => 100, 'bob' => 100, 'carol' => 80, 'dave' => 70] as $player => $score) {
            $records->saved($this->record($card, $player, $score));
        }

        self::assertSame(
            ['alice' => 0, 'bob' => 0, 'carol' => 0, 'dave' => 0],
            TrickCardPayment::query()->where('event_id', $event->event_id)
                ->orderBy('id')->pluck('points_paid', 'player_name')->all(),
        );
        self::assertSame(2, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('draw_points'));
        self::assertSame(0, $card->fresh()->paid_points_total);
        self::assertSame('2026-07-20 14:15:00', $card->fresh()->limit_at->format('Y-m-d H:i:s'));

        $rankings = $records->rankings($card);
        self::assertSame([1, 1, 3, 4], collect($rankings)->pluck('rank')->all());
        self::assertSame([5, 5, 2, 1], collect($rankings)->pluck('rps')->all());
        self::assertSame([3, 3, 1, 1], collect($rankings)->pluck('provisional_reward_points')->all());
        self::assertNotContains(false, collect($rankings)->pluck('initial_payment_recorded')->all(), true);

        Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->update(['rank_points' => 2]);
        $snapshot = app(TrickStateService::class)->snapshot($event, 'alice');
        self::assertSame(5, $snapshot['me']['provisional_rank_points']);
        self::assertSame(7, $snapshot['me']['total_rank_points']);
        self::assertSame(4, $snapshot['field'][0]['participant_count']);
        self::assertTrue($snapshot['field'][0]['my_initial_payment_recorded']);
        self::assertSame(2, $snapshot['field'][0]['my_initial_post_cost']);
    }

    public function test_paid_post_can_create_negative_balance(): void
    {
        [$event, $card] = $this->fixture();
        Player::query()->where('event_id', $event->event_id)->where('name', 'alice')
            ->update(['draw_points' => 0]);

        $records = app(TrickRecordService::class);
        $original = $this->record($card, 'alice', 100);
        $records->saved($original);
        $original->update(['flg' => 2]);
        $records->saved($this->record($card, 'alice', 120), $original);

        self::assertSame(-2, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('draw_points'));
        self::assertSame(2, TrickCardPayment::query()->where('event_id', $event->event_id)
            ->where('player_name', 'alice')->where('payment_type', 'score_update')->value('points_paid'));
        self::assertSame(2, $card->fresh()->paid_points_total);
    }

    public function test_edit_and_repost_charge_again_without_reextension(): void
    {
        [$event, $card] = $this->fixture();
        Player::query()->where('event_id', $event->event_id)->where('name', 'alice')
            ->update(['draw_points' => 10]);
        $records = app(TrickRecordService::class);
        $original = $this->record($card, 'alice', 100);
        $records->saved($original);
        $limit = $card->fresh()->limit_at->toDateTimeString();
        $points = Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->value('draw_points');

        $original->update(['flg' => 2]);
        $updated = $this->record($card, 'alice', 120);
        $records->saved($updated, $original);
        self::assertSame(2, TrickCardPayment::query()->where('event_id', $event->event_id)->count());
        self::assertSame($points - 2, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('draw_points'));
        self::assertSame($limit, $card->fresh()->limit_at->toDateTimeString());
        self::assertSame(120, $records->rankings($card)[0]['score']);

        $updated->update(['flg' => 2]);
        $records->deleted($updated);
        self::assertSame([], $records->rankings($card));
        self::assertSame(0, $card->fresh()->post_count);
        self::assertSame(2, TrickCardPayment::query()->where('event_id', $event->event_id)->count());

        $repost = $this->record($card, 'alice', 90);
        $records->saved($repost);
        self::assertSame(3, TrickCardPayment::query()->where('event_id', $event->event_id)->count());
        self::assertSame($points - 4, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('draw_points'));
        self::assertSame($limit, $card->fresh()->limit_at->toDateTimeString());
    }

    public function test_all_field_first_does_not_release_take_cooldown(): void
    {
        [$event, $firstCard] = $this->fixture();
        $now = CarbonImmutable::instance($event->debug_now);
        $secondDeck = Deck::query()->create([
            'eventId' => $event->event_id,
            'event_id' => $event->event_id,
            'stage_id' => 7102,
            'origin_stage_id' => 399,
            'card_id' => 920102,
            'title' => 'Phase 3 second card',
            'rule_name' => 'Rule',
            'state' => '_in_event',
            'text' => 'Test rule',
            'difficulty' => 2,
            'rewards' => 0,
        ]);
        $secondCard = TrickEventCard::query()->create([
            'event_id' => $event->event_id,
            'deck_id' => $secondDeck->id,
            'state' => '_field',
            'difficulty' => 2,
            'rarity' => 3,
            'stack_count' => 3,
            'taker' => 'alice',
            'taken_at' => $now,
            'limit_at' => $now->addMinutes(90),
        ])->load('deck');
        Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->update([
            'last_take_at' => $now,
        ]);

        $records = app(TrickRecordService::class);
        foreach ([$firstCard, $secondCard] as $card) {
            $records->saved($this->record($card, 'bob', 100));
            $records->saved($this->record($card, 'alice', 100));
        }

        $alice = Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->firstOrFail();
        self::assertNull($alice->take_cooldown_released_for);
        self::assertSame($now->addMinutes(60)->toIso8601String(),
            app(TrickStateService::class)->snapshot($event, 'alice')['me']['next_take_at']);

        foreach (range(1, 5) as $index) {
            $deck = Deck::query()->create([
                'eventId' => $event->event_id,
                'event_id' => $event->event_id,
                'stage_id' => 7200 + $index,
                'origin_stage_id' => 399,
                'card_id' => 920200 + $index,
                'title' => 'Cooldown hand '.$index,
                'rule_name' => 'Rule',
                'state' => '_in_event',
                'text' => 'Test rule',
                'difficulty' => 1,
                'rewards' => 0,
            ]);
            TrickEventCard::query()->create([
                'event_id' => $event->event_id,
                'deck_id' => $deck->id,
                'state' => 'alice',
                'difficulty' => 1,
                'rarity' => 1,
                'drawn_order' => $index,
            ]);
        }

        $selected = TrickEventCard::query()->where('event_id', $event->event_id)
            ->where('state', 'alice')->orderBy('drawn_order')->firstOrFail();
        $event->update(['debug_now' => $now->addMinutes(60)]);
        $take = app(TrickGameService::class)->take($event, 'alice', $selected->deck_id);
        self::assertSame('_field', $take['card']['state']);
        self::assertSame($now->addMinutes(120)->toIso8601String(), $take['player']['next_take_at']);
    }

    public function test_event_record_link_prevents_historical_stage_records_from_mixing(): void
    {
        [$event, $card] = $this->fixture();
        $records = app(TrickRecordService::class);
        $current = $this->record($card, 'alice', 100);
        $records->saved($current);
        $unlinkedHistorical = $this->record($card, 'mallory', 999);

        self::assertSame(['alice'], collect($records->rankings($card))->pluck('user_id')->all());
        self::assertFalse(TrickEventRecord::query()->where('record_id', $unlinkedHistorical->post_id)->exists());
        self::assertSame($event->event_id, TrickEventRecord::query()
            ->where('record_id', $current->post_id)->value('event_id'));
    }

    public function test_record_endpoint_rolls_back_normal_record_when_event_validation_fails(): void
    {
        [$event, $card] = $this->fixture();
        $payload = $this->recordPayload($card, 'mallory', 101);
        $this->postJson('/api/record', $payload)->assertStatus(401);
        self::assertFalse(Record::query()->where('user_id', 'mallory')
            ->where('stage_id', $card->deck->stage_id)->exists());

        $this->withHeaders($this->signedHeaders('alice'))
            ->postJson('/api/record', $this->recordPayload($card, 'bob', 102))
            ->assertStatus(403);
        $this->withHeaders($this->signedHeaders('alice'))
            ->postJson('/api/record', $this->recordPayload($card, 'alice', 102))
            ->assertOk()->assertExactJson(['OK', 200]);
        $saved = Record::query()->where('user_id', 'alice')
            ->where('stage_id', $card->deck->stage_id)->firstOrFail();
        self::assertSame($event->event_id, TrickEventRecord::query()
            ->where('record_id', $saved->post_id)->value('event_id'));
        self::assertSame(1, TrickCardPayment::query()->where('event_id', $event->event_id)->count());

        $invalidEdit = $this->recordPayload($card, 'alice', 103);
        $invalidEdit['mode'] = 'edit';
        $invalidEdit['edit_unique_id'] = $saved->unique_id;
        $invalidEdit['stage_id'] = $card->deck->stage_id + 1;
        $this->withHeaders($this->signedHeaders('alice'))
            ->postJson('/api/record', $invalidEdit)->assertStatus(422);
        self::assertSame('0', (string) $saved->fresh()->flg);
        self::assertSame(1, Record::query()->where('user_id', 'alice')->where('flg', '<', 2)->count());

        $saved->forceFill(['created_at' => now()->subHours(25)])->save();
        $this->deleteJson('/api/record/'.$saved->unique_id, ['editor_role' => 0])->assertStatus(500);
        self::assertSame('0', (string) $saved->fresh()->flg);
        $this->withHeaders($this->signedHeaders('admin', 10))
            ->deleteJson('/api/record/'.$saved->unique_id, ['editor_role' => 10])
            ->assertOk()->assertExactJson(['deleted']);
        self::assertSame('2', (string) $saved->fresh()->flg);
        self::assertSame(0, $card->fresh()->post_count);
        self::assertSame(1, TrickCardPayment::query()->where('event_id', $event->event_id)->count());
    }

    public function test_non_event_record_is_not_blocked_by_event_domain_validation(): void
    {
        $this->fixture();
        $deck = Deck::query()->create([
            'eventId' => 0,
            'event_id' => 0,
            'stage_id' => 7199,
            'origin_stage_id' => 399,
            'card_id' => 920199,
            'title' => 'Non-event card',
            'rule_name' => 'Rule',
            'state' => '_eligible',
            'text' => 'Normal record',
            'difficulty' => 1,
            'rewards' => 0,
        ]);
        $payload = $this->recordPayloadForStage($deck->stage_id, 'outsider', 101);

        $this->postJson('/api/record', $payload)->assertOk();
        self::assertTrue(Record::query()->where('user_id', 'outsider')->where('stage_id', 7199)->exists());
        self::assertSame(0, TrickEventRecord::query()->whereHas('record', fn ($query) => $query
            ->where('user_id', 'outsider'))->count());
    }

    public function test_public_payloads_exclude_private_and_audit_fields(): void
    {
        [$event, $card] = $this->fixture();
        app(TrickRecordService::class)->saved($this->record($card, 'alice', 100));
        $log = LimitLog::query()->create([
            'event' => 'take',
            'event_id' => $event->event_id,
            'event_card_id' => $card->id,
            'actor_name' => 'alice',
            'card_id' => $card->deck_id,
            'stacked_card_ids' => [111, 222],
            'card_snapshot' => ['hidden' => true],
            'player_snapshot' => ['hidden' => true],
            'context' => ['hidden' => true],
            'ip' => '192.0.2.1',
            'user_agent' => 'private-agent',
            'route' => 'private-route',
            'request_id' => 'private-request',
        ]);

        $publicLog = collect(app(TrickStateService::class)->logs($event))
            ->firstWhere('id', $log->id);
        self::assertNotNull($publicLog);
        foreach (['stacked_card_ids', 'card_snapshot', 'player_snapshot', 'context', 'ip', 'user_agent', 'route', 'request_id'] as $key) {
            self::assertArrayNotHasKey($key, $publicLog);
        }
        self::assertSame('Phase 3 card', $publicLog['card_title']);

        $recordLog = collect(app(TrickStateService::class)->logs($event))->firstWhere('event', 'record_posted');
        self::assertNotNull($recordLog);
        self::assertSame('Phase 3 card', $recordLog['card_title']);
        self::assertSame(100, $recordLog['score']);
        self::assertSame(1, $recordLog['rank']);

        $ranking = app(TrickRecordService::class)->rankings($card)[0];
        foreach (['user_ip', 'user_host', 'user_agent', 'post_memo'] as $key) {
            self::assertArrayNotHasKey($key, $ranking);
        }

        $snapshot = app(TrickStateService::class)->snapshot($event, null);
        self::assertSame([], $snapshot['hand']);
        self::assertArrayHasKey('subsidy_flag', $snapshot['players'][0]);
        self::assertIsBool($snapshot['players'][0]['subsidy_flag']);
        foreach (['subsidy_flag_slot_at', 'last_subsidy_paid_slot_at', 'created_at', 'updated_at'] as $key) {
            self::assertArrayNotHasKey($key, $snapshot['players'][0]);
        }
    }

    /** @return array{0: TrickEvent, 1: TrickEventCard} */
    private function fixture(): array
    {
        $now = CarbonImmutable::parse('2026-07-20 12:00:00', 'Asia/Tokyo');
        $event = TrickEvent::query()->create([
            'event_id' => 990101,
            'title' => 'Phase 3 test',
            'start_at' => $now->subHour(),
            'end_at' => $now->addHours(47),
            'state' => 'active',
            'debug' => true,
            'test_mode' => true,
            'debug_now' => $now,
            'initialized_at' => $now->subHour(),
        ]);
        $deck = Deck::query()->create([
            'eventId' => $event->event_id,
            'event_id' => $event->event_id,
            'stage_id' => 7101,
            'origin_stage_id' => 399,
            'card_id' => 920101,
            'title' => 'Phase 3 card',
            'rule_name' => 'Rule',
            'state' => '_in_event',
            'text' => 'Test rule',
            'difficulty' => 2,
            'rewards' => 0,
        ]);
        $card = TrickEventCard::query()->create([
            'event_id' => $event->event_id,
            'deck_id' => $deck->id,
            'state' => '_field',
            'difficulty' => 2,
            'rarity' => 3,
            'stack_count' => 3,
            'taker' => 'taker',
            'taken_at' => $now,
            'limit_at' => $now->addMinutes(90),
        ]);
        foreach (['alice', 'bob', 'carol', 'dave'] as $name) {
            Player::query()->create([
                'event_id' => $event->event_id,
                'name' => $name,
                'draw_points' => 2,
                'rank_points' => 0,
                'card_count' => 0,
            ]);
        }

        return [$event, $card];
    }

    private function record(TrickEventCard $card, string $userId, int $score): Record
    {
        return Record::query()->create([
            'user_id' => $userId,
            'score' => $score,
            'stage_id' => $card->deck->stage_id,
            'rule' => 1,
            'console' => 1,
            'difficulty' => 2,
            'region' => '1',
            'team' => 0,
            'unique_id' => random_int(100000000, 999999999),
            'post_comment' => 'phase 3 test',
            'user_ip' => '127.0.0.1',
            'user_host' => 'localhost',
            'user_agent' => 'phpunit',
            'img_url' => '',
            'video_url' => '',
            'post_memo' => '',
            'flg' => 0,
        ]);
    }

    private function recordPayload(TrickEventCard $card, string $userId, int $score): array
    {
        return $this->recordPayloadForStage($card->deck->stage_id, $userId, $score);
    }

    private function recordPayloadForStage(int $stageId, string $userId, int $score): array
    {
        return [
            'user_id' => $userId,
            'score' => $score,
            'stage_id' => $stageId,
            'rule' => 1,
            'console' => 1,
            'difficulty' => 2,
            'region' => 1,
            'post_comment' => 'phase 3 endpoint test',
            'user_agent' => 'phpunit',
            'video_url' => '',
            'mode' => 'create',
        ];
    }

    private function signedHeaders(string $userId, int $role = 0): array
    {
        $timestamp = (string) time();
        $roleValue = (string) $role;

        return [
            'x-tricks-user' => $userId,
            'x-tricks-role' => $roleValue,
            'x-tricks-identity-kind' => 'session',
            'x-tricks-test-event' => '',
            'x-tricks-timestamp' => $timestamp,
            'x-tricks-signature' => hash_hmac(
                'sha256',
                $timestamp."\n".$userId."\n".$roleValue."\nsession\n",
                $this->testSecret,
            ),
        ];
    }
}
