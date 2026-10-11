<?php

namespace Tests\Feature\Tricks;

use App\Models\Deck;
use App\Models\Player;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use App\Services\Tricks\TrickDebugTimeService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TrickPhaseFiveTest extends TestCase
{
    use RefreshDatabase;

    public function test_debug_advance_processes_intermediate_subsidy_expiry_and_event_end(): void
    {
        [$event, $card] = $this->fixture(true);
        $result = app(TrickDebugTimeService::class)->advance($event, 30 * 60, 'admin');

        self::assertSame(1, $result['collected']);
        self::assertSame(0, $result['subsidy_paid']);
        self::assertSame('_collected', $card->fresh()->state);
        self::assertSame(5, Player::query()->where('event_id', $event->event_id)->value('draw_points'));

        $ended = app(TrickDebugTimeService::class)->advance($event->fresh(), 4 * 3600, 'admin');
        self::assertTrue($ended['ended']);
        self::assertSame('ended', $event->fresh()->state);
        self::assertSame('_eligible', $card->deck->fresh()->state);
    }

    public function test_debug_time_api_requires_debug_admin_and_rejects_rewind(): void
    {
        [$event] = $this->fixture(true);
        putenv('TRICKS_EVENT_ID='.$event->event_id);
        putenv('TRICKS_INTERNAL_SECRET=phase-five-secret');
        try {
            $path = '/api/tricks/debug/time/advance';
            $this->postJson($path, ['minutes' => 1])->assertStatus(401);
            $this->withHeaders($this->signedHeaders('alice', 0))->postJson($path, ['minutes' => 1])->assertStatus(403);
            $this->withHeaders($this->signedHeaders('admin', 10))->postJson($path, ['minutes' => 1])
                ->assertOk()->assertJsonPath('frozen', true);
            $this->withHeaders($this->signedHeaders('admin', 10))->postJson('/api/tricks/debug/time/set', [
                'now' => '2026-07-20T08:00:00+09:00',
            ])->assertStatus(422);

            $event->update(['debug' => false, 'test_mode' => false, 'debug_now' => null]);
            $this->withHeaders($this->signedHeaders('admin', 10))->postJson($path, ['minutes' => 1])->assertStatus(403);
        } finally {
            putenv('TRICKS_EVENT_ID');
            putenv('TRICKS_INTERNAL_SECRET');
        }
    }

    public function test_tournament_totals_and_live_admin_stats_are_event_scoped(): void
    {
        [$event, $card] = $this->fixture(true);
        $event->update(['pot_points' => 7]);
        $card->update(['draw_count' => 3, 'paid_points_total' => 2]);
        Player::query()->where('event_id', $event->event_id)->update(['take_count' => 2, 'draw_points' => 4]);
        \App\Models\LimitLog::query()->create([
            'event_id' => $event->event_id, 'event' => 'draw', 'actor_name' => 'alice', 'points_delta' => -1,
        ]);
        \App\Models\LimitLog::query()->create([
            'event_id' => $event->event_id, 'event' => 'balance_tax_collected',
            'actor_name' => 'admin', 'affected_player_name' => 'alice', 'points_delta' => -1,
        ]);
        $snapshot = app(\App\Services\Tricks\TrickStateService::class)->snapshot($event->fresh(), 'alice');
        self::assertSame(1, $snapshot['draw_total']);
        self::assertSame(2, $snapshot['take_total']);
        // Balance 4 + pot 7 + field stack 3 + payment 2; spent points are not added.
        self::assertSame(16, $snapshot['points_total']);
        $card->update(['post_count' => 1]);
        $snapshot = app(\App\Services\Tricks\TrickStateService::class)->snapshot($event->fresh(), 'alice');
        self::assertSame(16, $snapshot['points_total'], 'Pot must not be counted twice');

        putenv('TRICKS_EVENT_ID='.$event->event_id);
        putenv('TRICKS_INTERNAL_SECRET=phase-five-secret');
        try {
            $path = '/api/tricks/collected/admin-stats?event_id='.$event->event_id;
            $this->withHeaders($this->signedHeaders('alice', 0))->getJson($path)->assertForbidden();
            $this->withHeaders($this->signedHeaders('admin', 10))->getJson($path)->assertOk()
                ->assertJsonPath('users.0.draw_count', 1)
                ->assertJsonPath('users.0.spent_points', 2)
                ->assertJsonPath('users.0.earned_points', 6)
                ->assertJsonPath('cards.0.stage_id', 7301)
                ->assertJsonPath('cards.0.field_seconds', 5100)
                ->assertJsonPath('cards.0.total_reward_points', null);
            $card->update(['state' => '_collected', 'collected_at' => $card->taken_at->addMinutes(30)]);
            $event->update(['state' => 'ended']);
            $this->withHeaders($this->signedHeaders('admin', 10))->getJson($path)->assertOk()
                ->assertJsonPath('cards.0.field_seconds', 1800)
                ->assertJsonPath('cards.0.total_reward_points', 0);
            $snapshot = app(\App\Services\Tricks\TrickStateService::class)->snapshot($event->fresh(), 'alice');
            self::assertSame(11, $snapshot['points_total'], 'Excluded card reward is not counted');
            $card->update(['draw_count' => 0]);
            $snapshot = app(\App\Services\Tricks\TrickStateService::class)->snapshot($event->fresh(), 'alice');
            self::assertSame(1, $snapshot['draw_total'], 'Opening counter resets do not erase draw history');
        } finally {
            putenv('TRICKS_EVENT_ID');
            putenv('TRICKS_INTERNAL_SECRET');
        }
    }

    public function test_admin_metrics_count_pools_without_pots_and_unique_participants_per_creator_card(): void
    {
        [$event, $liveCard] = $this->fixture(true);
        $event->update(['pot_points' => 99]);
        $liveCard->update(['rarity' => 2, 'paid_points_total' => 2]); // 3 + 2 bonus + 2 paid = 7.
        foreach (['alice' => '共同作者A', 'bob' => '作者B', 'blank' => ''] as $userId => $screenName) {
            \App\Models\User::query()->create([
                'user_id' => $userId, 'user_name' => $screenName,
                'email' => $userId.'@example.invalid', 'password' => 'unused-test-placeholder',
            ]);
            if ($userId !== 'alice') {
                Player::query()->create(['event_id' => $event->event_id, 'name' => $userId, 'draw_points' => 5]);
            }
        }
        $liveCard->deck->update(['creator' => 'alice']); // ID alone must not match a screen name.
        foreach ([['alice', 6, 4, 3], ['bob', 3, 1, 1], [null, 30, 90, 5]] as $i => [$taker, $stack, $paid, $rarity]) {
            $deck = $liveCard->deck->replicate();
            $deck->stage_id = 7302 + $i;
            $deck->card_id = 940002 + $i;
            $deck->creator = '共同作者A ＆ 作者B（共同案）';
            $deck->save();
            $card = $liveCard->replicate();
            $card->deck_id = $deck->id;
            $card->taker = $taker;
            $card->stack_count = $stack;
            $card->paid_points_total = $paid;
            $card->rarity = $rarity;
            $card->state = '_collected';
            $card->collected_at = $event->debug_now;
            $card->save();
            foreach (['alice', 'alice', 'bob'] as $j => $userId) {
                $recordId = 960000 + $i * 10 + $j;
                DB::table('records')->insert([
                    'post_id' => $recordId, 'user_id' => $userId, 'score' => 100 + $j,
                    'stage_id' => $deck->stage_id, 'rule' => $event->event_id, 'console' => 1, 'region' => '1',
                    'unique_id' => $recordId, 'post_comment' => '', 'user_ip' => '', 'user_host' => '',
                    'user_agent' => '', 'img_url' => '', 'video_url' => '', 'post_memo' => '',
                    'flg' => 0, 'team' => 0, 'created_at' => now(), 'updated_at' => now(),
                ]);
                \App\Models\TrickEventRecord::query()->create([
                    'record_id' => $recordId, 'event_id' => $event->event_id,
                    'event_card_id' => $card->id, 'deck_id' => $card->deck_id,
                ]);
            }
            \App\Models\LimitLog::query()->create([
                'event_id' => $event->event_id, 'event_card_id' => $card->id, 'event' => 'collect',
                'context' => ['pot_points_used' => 99, 'final_rankings' => [
                    ['user_id' => 'alice'], ['user_id' => 'alice'], ['user_id' => 'bob'],
                ]],
            ]);
            \App\Models\TrickCollectionReward::query()->create([
                'event_id' => $event->event_id, 'event_card_id' => $card->id,
                'deck_id' => $deck->id, 'player_name' => 'alice', 'points_delta' => 999, 'reward_type' => 'test',
            ]);
        }
        putenv('TRICKS_EVENT_ID='.$event->event_id);
        putenv('TRICKS_INTERNAL_SECRET=phase-five-secret');
        try {
            $response = $this->withHeaders($this->signedHeaders('admin', 10))
                ->getJson('/api/tricks/collected/admin-stats?event_id='.$event->event_id)->assertOk();
            $users = collect($response->json('users'))->keyBy('user_id');
            self::assertSame(23, $users['alice']['generated_points_total']); // Live 7 + collected 16.
            self::assertSame(4, $users['bob']['generated_points_total']);
            self::assertSame(4, $users['alice']['popular_creator_index']); // 2 + 2, not 2 globally.
            self::assertSame(4, $users['bob']['popular_creator_index']);
            self::assertSame(0, $users['blank']['popular_creator_index']);
            self::assertArrayNotHasKey('creator_take_count', $users['alice']);
        } finally {
            putenv('TRICKS_EVENT_ID');
            putenv('TRICKS_INTERNAL_SECRET');
        }
    }

    public function test_admin_card_stats_count_only_successful_paid_manual_extensions(): void
    {
        [$event, $card] = $this->fixture(true);
        $game = app(\App\Services\Tricks\TrickGameService::class);
        $game->extend($event, 'alice', $card->deck_id, 'stats-extend-one');
        $game->extend($event, 'alice', $card->deck_id, 'stats-extend-one'); // Replay is not another extension.
        $game->extend($event, 'alice', $card->deck_id, 'stats-extend-two');
        \App\Models\LimitLog::query()->create([
            'event_id' => $event->event_id, 'event_card_id' => $card->id, 'event' => 'limit_extended',
            'context' => ['extension_minutes' => 15],
        ]);
        foreach (['initial_post', 'score_update', 'player_extension'] as $type) {
            \App\Models\TrickCardPayment::query()->create([
                'event_id' => $event->event_id, 'event_card_id' => $card->id, 'deck_id' => $card->deck_id,
                'stage_id' => 7301, 'player_name' => 'alice', 'payment_type' => $type,
                'points_paid' => $type === 'player_extension' ? 0 : 1,
                'idempotency_key' => 'stats-excluded-'.$type,
            ]);
        }
        $otherDeck = $card->deck->replicate();
        $otherDeck->stage_id = 7302;
        $otherDeck->save();
        $otherCard = $card->replicate();
        $otherCard->deck_id = $otherDeck->id;
        $otherCard->save();
        putenv('TRICKS_EVENT_ID='.$event->event_id);
        putenv('TRICKS_INTERNAL_SECRET=phase-five-secret');
        try {
            $path = '/api/tricks/collected/admin-stats?event_id='.$event->event_id;
            $this->withHeaders($this->signedHeaders('admin', 10))->getJson($path)->assertOk()
                ->assertJsonPath('cards.0.paid_extension_count', 2)
                ->assertJsonPath('cards.1.paid_extension_count', 0);
            $card->update(['state' => '_collected', 'collected_at' => $event->debug_now]);
            $this->withHeaders($this->signedHeaders('admin', 10))->getJson($path)->assertOk()
                ->assertJsonPath('cards.0.paid_extension_count', 2);
        } finally {
            putenv('TRICKS_EVENT_ID');
            putenv('TRICKS_INTERNAL_SECRET');
        }
    }

    public function test_admin_card_post_count_counts_valid_records_instead_of_players(): void
    {
        [$event, $card] = $this->fixture(true);
        $card->update(['post_count' => 2]); // Internal counter intentionally remains a player count.
        foreach ([['alice', 0], ['alice', 0], ['bob', 1], ['deleted_only', 2]] as $i => [$userId, $flag]) {
            $recordId = 950000 + $i;
            DB::table('records')->insert([
                'post_id' => $recordId, 'user_id' => $userId, 'score' => 100 + $i,
                'stage_id' => 7301, 'rule' => $event->event_id, 'console' => 1, 'region' => '1',
                'unique_id' => $recordId, 'post_comment' => '', 'user_ip' => '', 'user_host' => '',
                'user_agent' => '', 'img_url' => '', 'video_url' => '', 'post_memo' => '',
                'flg' => $flag, 'team' => 0, 'created_at' => now(), 'updated_at' => now(),
            ]);
            \App\Models\TrickEventRecord::query()->create([
                'record_id' => $recordId, 'event_id' => $event->event_id,
                'event_card_id' => $card->id, 'deck_id' => $card->deck_id,
            ]);
        }
        putenv('TRICKS_EVENT_ID='.$event->event_id);
        putenv('TRICKS_INTERNAL_SECRET=phase-five-secret');
        try {
            $path = '/api/tricks/collected/admin-stats?event_id='.$event->event_id;
            $response = $this->withHeaders($this->signedHeaders('admin', 10))->getJson($path)->assertOk()
                ->assertJsonPath('cards.0.post_count', 3);
            self::assertCount(2, $response->json('cards.0.participants'));
            self::assertNotContains('deleted_only', $response->json('cards.0.participants'));
            self::assertSame(2, $card->fresh()->post_count);
            $card->update(['state' => '_collected', 'collected_at' => $event->debug_now]);
            \App\Models\LimitLog::query()->create([
                'event_id' => $event->event_id, 'event_card_id' => $card->id, 'event' => 'collect',
                'context' => ['final_rankings' => [['user_id' => 'alice'], ['user_id' => 'bob'], ['user_id' => 'deleted_only']]],
            ]);
            $response = $this->withHeaders($this->signedHeaders('admin', 10))->getJson($path)->assertOk()
                ->assertJsonPath('cards.0.post_count', 3);
            self::assertCount(2, $response->json('cards.0.participants'));
            DB::table('records')->where('post_id', 950001)->update(['flg' => 2]);
            $this->withHeaders($this->signedHeaders('admin', 10))->getJson($path)->assertOk()
                ->assertJsonPath('cards.0.post_count', 2);
            DB::table('records')->where('post_id', 950002)->update(['flg' => 2]);
            $response = $this->withHeaders($this->signedHeaders('admin', 10))->getJson($path)->assertOk()
                ->assertJsonPath('cards.0.post_count', 1);
            self::assertSame(['alice'], $response->json('cards.0.participants'));
        } finally {
            putenv('TRICKS_EVENT_ID');
            putenv('TRICKS_INTERNAL_SECRET');
        }
    }

    /** @return array{0: TrickEvent, 1: TrickEventCard} */
    private function fixture(bool $debug): array
    {
        $now = CarbonImmutable::parse('2026-07-20 08:50:00', 'Asia/Tokyo');
        $event = TrickEvent::query()->create([
            'event_id' => 990301,
            'title' => 'Phase 5 test',
            'start_at' => $now->subMinutes(50),
            'end_at' => $now->addHours(3)->addMinutes(10),
            'state' => 'active',
            'debug' => $debug,
            'test_mode' => false,
            'debug_now' => $debug ? $now : null,
            'initialized_at' => $now->subMinutes(50),
        ]);
        Player::query()->create([
            'event_id' => $event->event_id,
            'name' => 'alice',
            'draw_points' => 5,
            'rank_points' => 0,
            'card_count' => 0,
            'subsidy_flag' => true,
            'subsidy_flag_slot_at' => '2026-07-20 09:00:00',
            'created_at' => $now->subMinutes(50),
            'updated_at' => $now->subMinutes(50),
        ]);
        $deck = Deck::query()->create([
            'eventId' => $event->event_id,
            'event_id' => $event->event_id,
            'stage_id' => 7301,
            'origin_stage_id' => 399,
            'card_id' => 940001,
            'title' => 'Phase 5 card',
            'rule_name' => 'Rule',
            'state' => '_in_event',
            'text' => 'Test rule',
            'difficulty' => 1,
            'rewards' => 0,
        ]);
        $card = TrickEventCard::query()->create([
            'event_id' => $event->event_id,
            'deck_id' => $deck->id,
            'state' => '_field',
            'difficulty' => 1,
            'rarity' => 1,
            'stack_count' => 3,
            'taker' => 'alice',
            'taken_at' => $now->subMinutes(85),
            'limit_at' => '2026-07-20 09:05:00',
        ]);

        return [$event, $card];
    }

    private function signedHeaders(string $userId, int $role): array
    {
        $timestamp = (string) time();

        return [
            'x-tricks-user' => $userId,
            'x-tricks-role' => (string) $role,
            'x-tricks-identity-kind' => 'session',
            'x-tricks-timestamp' => $timestamp,
            'x-tricks-signature' => hash_hmac(
                'sha256',
                $timestamp."\n".$userId."\n".$role."\n".'session'."\n",
                'phase-five-secret',
            ),
        ];
    }
}
