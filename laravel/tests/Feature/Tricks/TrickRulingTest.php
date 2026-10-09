<?php

namespace Tests\Feature\Tricks;

use App\Models\Deck;
use App\Models\Player;
use App\Models\Record;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use App\Models\TrickCardPayment;
use App\Services\Tricks\TrickRecordService;
use App\Services\Tricks\TrickRulingService;
use App\Services\Tricks\TrickSubsidyService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class TrickRulingTest extends TestCase
{
    use RefreshDatabase;

    public function test_reset_preserves_economy_compensates_active_players_once_and_repost_is_paid(): void
    {
        [$event, $card] = $this->fixture(['alice', 'bob', 'carol']);
        $records = app(TrickRecordService::class);
        $alice = $this->record($card, 'alice', 300);
        $alice->update(['post_memo' => str_repeat('a', 1024)]);
        $records->saved($alice);
        $bob = $this->record($card, 'bob', 200);
        $records->saved($bob);
        $carol = $this->record($card, 'carol', 100);
        $records->saved($carol);
        $carol->update(['flg' => 2]);
        $records->deleted($carol);
        $before = Player::query()->where('event_id', $event->event_id)->pluck('draw_points', 'name');
        $paid = $card->fresh()->paid_points_total;
        $payments = TrickCardPayment::query()->count();
        $service = app(TrickRulingService::class);
        $data = ['idempotency_key' => 'reset-test-0001'];
        $result = $service->apply($event, $card->deck_id, 'admin', $data, true, Request::create('/reset', 'POST'));
        self::assertSame(['deleted' => 2, 'compensated' => 2], $result);
        self::assertSame($result, $service->apply($event, $card->deck_id, 'admin', $data, true, Request::create('/reset', 'POST')));
        self::assertSame(['deleted' => 0, 'compensated' => 0], $service->apply($event, $card->deck_id, 'admin', ['idempotency_key' => 'empty-reset-0001'], true, Request::create('/reset', 'POST')));
        self::assertSame([], $records->rankings($card->fresh()));
        self::assertSame($paid, $card->fresh()->paid_points_total);
        self::assertSame($payments, TrickCardPayment::query()->count());
        self::assertStringStartsWith(str_repeat('a', 1024), $alice->fresh()->post_memo);
        self::assertStringContainsString('管理者権限による削除（2026-07-20 12:00:00）', $alice->fresh()->post_memo);
        foreach (['alice', 'bob', 'carol'] as $name) {
            $player = Player::query()->where('event_id', $event->event_id)->where('name', $name)->firstOrFail();
            self::assertSame($before[$name] + ($name === 'carol' ? 0 : 5), $player->draw_points);
            self::assertSame($name !== 'carol', $player->ranking_reset_tax_exempt);
        }
        $records->saved($this->record($card, 'alice', 400));
        self::assertSame('score_update', TrickCardPayment::query()->latest('id')->value('payment_type'));
        self::assertGreaterThan($paid, $card->fresh()->paid_points_total);
    }

    public function test_exemption_is_consumed_at_first_slot_even_below_threshold(): void
    {
        [$event] = $this->fixture(['alice', 'bob', 'carol']);
        Player::query()->where('name', 'alice')->update(['draw_points' => 30, 'ranking_reset_tax_exempt' => true]);
        Player::query()->where('name', 'bob')->update(['draw_points' => 5, 'ranking_reset_tax_exempt' => true]);
        Player::query()->where('name', 'carol')->update(['draw_points' => 30]);
        $subsidy = app(TrickSubsidyService::class);
        $slot = CarbonImmutable::instance($event->debug_now);
        self::assertSame(1, $subsidy->processSlot($event, $slot)['taxed']);
        self::assertSame(0, Player::query()->where('ranking_reset_tax_exempt', true)->count());
        self::assertSame(30, Player::query()->where('name', 'alice')->value('draw_points'));
        $subsidy->processSlot($event, $slot);
        self::assertSame(30, Player::query()->where('name', 'alice')->value('draw_points'));
        Player::query()->where('name', 'bob')->update(['draw_points' => 30]);
        self::assertSame(3, $subsidy->processSlot($event, $slot->addMinutes(30))['taxed']);
        self::assertSame(29, Player::query()->where('name', 'bob')->value('draw_points'));
    }

    public function test_rule_edit_preserves_card_economy_and_rejects_collected_cards(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        $data = ['idempotency_key' => 'rule-test-0001', 'title' => 'Changed', 'rule_name' => 'Ruling', 'text' => 'New rule', 'difficulty' => 4, 'paid_points_total' => 999];
        app(TrickRulingService::class)->apply($event, $card->deck_id, 'admin', $data, false, Request::create('/rule', 'POST'));
        self::assertSame('New rule', $card->deck->fresh()->text);
        self::assertSame(4, $card->fresh()->difficulty);
        self::assertSame(0, $card->fresh()->paid_points_total);
        $card->update(['state' => '_collected']);
        $this->expectException(\Illuminate\Http\Exceptions\HttpResponseException::class);
        app(TrickRulingService::class)->apply($event, $card->deck_id, 'admin', ['idempotency_key' => 'reset-collected'], true, Request::create('/reset', 'POST'));
    }
    public function test_ruling_endpoints_require_admin_and_validate_input(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        putenv('TRICKS_EVENT_ID='.$event->event_id);
        putenv('TRICKS_INTERNAL_SECRET=ruling-test-secret');
        try {
            foreach (['reset', 'rule'] as $action) {
                $path = '/api/tricks/cards/'.$card->deck_id.'/'.$action;
                $this->flushHeaders();
                $this->postJson($path)->assertStatus(401);
                $this->withHeaders($this->signedHeaders(0))->postJson($path)->assertStatus(403);
                $this->withHeaders($this->signedHeaders(10))->postJson($path)->assertStatus(422);
            }
            $this->withHeaders($this->signedHeaders(10))
                ->postJson('/api/tricks/cards/'.$card->deck_id.'/rule', [
                    'idempotency_key' => 'api-rule-0001', 'title' => 'API title',
                    'rule_name' => 'API rule', 'text' => 'API body', 'difficulty' => 3,
                ])->assertOk();
            self::assertSame('API body', $card->deck->fresh()->text);
            $this->postJson('/api/tricks/cards/'.$card->deck_id.'/reset', ['idempotency_key' => 'api-reset-0001'])
                ->assertOk()->assertJsonPath('deleted', 0);
        } finally {
            putenv('TRICKS_EVENT_ID');
            putenv('TRICKS_INTERNAL_SECRET');
        }
    }

    private function signedHeaders(int $role): array
    {
        $timestamp = (string) time();
        return [
            'x-tricks-user' => 'admin', 'x-tricks-role' => (string) $role,
            'x-tricks-identity-kind' => 'session', 'x-tricks-timestamp' => $timestamp,
            'x-tricks-signature' => hash_hmac('sha256', $timestamp."\nadmin\n".$role."\nsession\n", 'ruling-test-secret'),
        ];
    }

    public function test_unposted_taker_receives_only_small_integer_remainder(): void
    {
        [$event, $card] = $this->fixture(['alice', 'bob', 'carol'], ['stack_count' => 2]);
        $records = app(TrickRecordService::class);
        $records->saved($this->record($card, 'bob', 999999));
        $records->saved($this->record($card, 'carol', 999999));
        $event->update(['pot_points' => 1]);
        $snapshot = app(\App\Services\Tricks\TrickStateService::class)->snapshot($event->fresh(), 'alice');
        $field = $snapshot['field'][0];
        $preview = $records->rankings($card->fresh());
        self::assertSame(3, $field['live_total_reward']);
        self::assertSame(1, $field['provisional_taker_remainder']);
        self::assertSame($field['live_total_reward'], array_sum(array_column($preview, 'provisional_reward_points')) + $field['provisional_taker_remainder']);
        app(\App\Services\Tricks\TrickCollectionService::class)->collect($event->fresh(), $card->deck_id, true);
        self::assertSame(1, \App\Models\TrickCollectionReward::query()->where('reward_type', 'taker_remainder')->where('player_name', 'alice')->value('points_delta'));
        self::assertSame(0, (int) $event->fresh()->pot_points);
    }

    public function test_score_above_six_digits_is_rejected(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        $this->expectException(\Illuminate\Http\Exceptions\HttpResponseException::class);
        app(TrickRecordService::class)->saved($this->record($card, 'alice', 1000000));
    }

    public function test_empty_card_points_disappear_without_entering_pot_and_stack_opening_resets(): void
    {
        [$event, $card] = $this->fixture(['alice'], ['stack_count' => 5]);
        $event->update(['pot_points' => 4]);
        $card->update(['paid_points_total' => 10]);
        $stack = $this->eventCard($event, '_stack', 930002, 7202);
        $stack->update(['stack_parent_id' => $card->id, 'draw_count' => 3, 'rarity' => 5]);
        app(\App\Services\Tricks\TrickCollectionService::class)->collect($event->fresh(), $card->deck_id, true);
        self::assertSame(4, (int) $event->fresh()->pot_points);
        self::assertSame(0, \App\Models\TrickCollectionReward::query()->count());
        self::assertSame('_trash', $stack->fresh()->state);
        self::assertSame(0, $stack->fresh()->draw_count);
        self::assertNull($stack->fresh()->rarity);
        self::assertFalse(app(\App\Services\Tricks\TrickStateService::class)->normalizeCard($stack->fresh())['was_opened']);
    }

    public function test_extension_moves_provisional_pot_to_the_next_eligible_card(): void
    {
        [$event, $card] = $this->fixture(['alice', 'bob']);
        $second = $this->eventCard($event, '_field', 930002, 7202);
        $now = CarbonImmutable::instance($event->debug_now);
        $card->refresh()->update(['limit_at' => $now->addMinutes(10)]);
        $second->refresh()->update(['limit_at' => $now->addMinutes(20)]);
        $event->update(['pot_points' => 7]);
        $records = app(TrickRecordService::class);
        $records->saved($this->record($card, 'alice', 100));
        $records->saved($this->record($second, 'bob', 200));
        $card->refresh()->update(['limit_at' => $now->addMinutes(10)]);
        $second->refresh()->update(['limit_at' => $now->addMinutes(20)]);
        $state = app(\App\Services\Tricks\TrickStateService::class);
        $before = collect($state->snapshot($event->fresh(), 'alice')['field'])->keyBy('id');
        self::assertSame(7, $before[$card->deck_id]['provisional_pot_points']);
        self::assertSame(0, $before[$second->deck_id]['provisional_pot_points']);
        app(\App\Services\Tricks\TrickGameService::class)->extend($event->fresh(), 'alice', $card->deck_id, 'pot-extension-0001');
        $after = collect($state->snapshot($event->fresh(), 'alice')['field'])->keyBy('id');
        self::assertSame(0, $after[$card->deck_id]['provisional_pot_points']);
        self::assertSame(7, $after[$second->deck_id]['provisional_pot_points']);
        foreach ([$card, $second] as $current) {
            self::assertSame($after[$current->deck_id]['live_total_reward'], array_sum(array_column($records->rankings($current->fresh()), 'provisional_reward_points')));
        }
    }

    private function fixture(array $players, array $options = []): array
    {
        $now = CarbonImmutable::parse('2026-07-20 12:00:00', 'Asia/Tokyo');
        $event = TrickEvent::query()->create([
            'event_id' => 990201,
            'title' => 'Phase 4 test',
            'start_at' => $now->subHours(4),
            'end_at' => $now->addHours(44),
            'state' => 'active',
            'debug' => true,
            'test_mode' => true,
            'debug_now' => $now,
            'initialized_at' => $now->subHours(4),
        ]);
        foreach ($players as $name) {
            Player::query()->create([
                'event_id' => $event->event_id,
                'name' => $name,
                'draw_points' => 10,
                'rank_points' => 0,
                'card_count' => 0,
                'created_at' => $now->subHours(4),
                'updated_at' => $now->subHours(4),
            ]);
        }
        $card = $this->eventCard($event, '_field', 930001, 7201, $options);

        return [$event, $card];
    }

    private function eventCard(
        TrickEvent $event,
        string $state,
        int $cardId,
        int $stageId,
        array $options = [],
    ): TrickEventCard {
        $deck = Deck::query()->create([
            'eventId' => $event->event_id,
            'event_id' => $event->event_id,
            'stage_id' => $stageId,
            'origin_stage_id' => 399,
            'card_id' => $cardId,
            'title' => 'Phase 4 card '.$cardId,
            'rule_name' => 'Rule',
            'state' => '_in_event',
            'text' => 'Test rule',
            'difficulty' => $options['difficulty'] ?? 2,
            'rewards' => 0,
        ]);

        return TrickEventCard::query()->create([
            'event_id' => $event->event_id,
            'deck_id' => $deck->id,
            'state' => $state,
            'difficulty' => $options['difficulty'] ?? 2,
            'rarity' => $options['rarity'] ?? 1,
            'stack_count' => $options['stack_count'] ?? 3,
            'taker' => $options['taker'] ?? 'alice',
            'taken_at' => $event->debug_now,
            'limit_at' => $state === '_field' ? $event->debug_now->addHour() : null,
        ]);
    }

    private function stackCard(TrickEvent $event, TrickEventCard $parent): TrickEventCard
    {
        $stack = $this->eventCard($event, '_stack', 930099, 7299);
        $stack->update(['stack_parent_id' => $parent->id]);

        return $stack;
    }

    private function record(TrickEventCard $card, string $userId, int $score): Record
    {
        return Record::query()->create([
            'user_id' => $userId,
            'score' => $score,
            'stage_id' => $card->deck->stage_id,
            'rule' => 1,
            'console' => 1,
            'difficulty' => $card->difficulty,
            'region' => '1',
            'team' => 0,
            'unique_id' => random_int(100000000, 999999999),
            'post_comment' => 'phase 4 test',
            'user_ip' => '127.0.0.1',
            'user_host' => 'localhost',
            'user_agent' => 'phpunit',
            'img_url' => '',
            'video_url' => '',
            'post_memo' => '',
            'flg' => 0,
        ]);
    }

}
