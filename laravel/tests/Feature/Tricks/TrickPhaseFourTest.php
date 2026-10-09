<?php

namespace Tests\Feature\Tricks;

use App\Models\Deck;
use App\Models\LimitLog;
use App\Models\Player;
use App\Models\Record;
use App\Models\TrickCardHolder;
use App\Models\TrickCollectionReward;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use App\Services\Tricks\TrickCollectionService;
use App\Services\Tricks\TrickEventFinalizer;
use App\Services\Tricks\TrickGameService;
use App\Services\Tricks\TrickRecordService;
use App\Services\Tricks\TrickStateService;
use App\Services\Tricks\TrickSubsidyService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrickPhaseFourTest extends TestCase
{
    use RefreshDatabase;

    public function test_single_player_collection_is_fixed_and_idempotent(): void
    {
        [$event, $card] = $this->fixture(['alice'], ['rarity' => 2]);
        $stack = $this->stackCard($event, $card);
        $record = $this->record($card, 'alice', 100);
        $records = app(TrickRecordService::class);
        $records->saved($record);

        $result = app(TrickCollectionService::class)->collect($event, $card->deck_id, true);
        self::assertTrue($result['collected_now']);
        self::assertSame(2, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('rank_points'));
        self::assertSame(15, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('draw_points'));
        self::assertSame('single_fixed', TrickCollectionReward::query()
            ->where('event_id', $event->event_id)->value('reward_type'));
        self::assertSame(7, TrickCollectionReward::query()
            ->where('event_id', $event->event_id)->value('points_delta'));
        self::assertSame(['alice'], TrickCardHolder::query()
            ->where('event_id', $event->event_id)->pluck('player_name')->all());
        self::assertSame('_held', $card->deck->fresh()->state);
        self::assertSame('_collected', $card->fresh()->state);
        self::assertSame('_trash', $stack->fresh()->state);
        self::assertSame(7, $result['rankings'][0]['provisional_reward_points']);

        $holderCard = app(TrickStateService::class)->snapshot($event, 'alice')['holder_cards'][0];
        self::assertSame($card->deck_id, $holderCard['id']);
        self::assertSame($card->deck->title, $holderCard['title']);
        self::assertSame($card->deck->rule_name, $holderCard['rule_name']);
        self::assertSame($card->deck->stage_id, $holderCard['stage_id']);
        $this->getJson('/api/tricks/cards/'.$holderCard['id'].'/scores?event_id='.$event->event_id)
            ->assertOk()->assertJsonPath('0.user_id', 'alice');

        $second = app(TrickCollectionService::class)->collect($event, $card->deck_id);
        self::assertFalse($second['collected_now']);
        self::assertSame(15, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('draw_points'));
        self::assertSame(1, LimitLog::query()->where('event_id', $event->event_id)->where('event', 'collect')->count());

        $record->update(['flg' => 2]);
        $records->deleted($record->fresh());
        $third = app(TrickCollectionService::class)->collect($event, $card->deck_id);
        self::assertSame('alice', $third['rankings'][0]['user_id']);
        self::assertSame(1, $card->fresh()->post_count);
        self::assertSame('alice', $card->fresh()->top_player);
    }

    public function test_multi_player_collection_confirms_tied_ranks_and_excludes_last_place(): void
    {
        [$event, $card] = $this->fixture(['alice', 'bob', 'carol', 'dave'], [
            'rarity' => 1,
            'difficulty' => 2,
        ]);
        $records = app(TrickRecordService::class);
        foreach (['alice' => 100, 'bob' => 100, 'carol' => 80, 'dave' => 70] as $player => $score) {
            $records->saved($this->record($card, $player, $score));
        }

        app(TrickCollectionService::class)->collect($event, $card->deck_id, true);
        self::assertSame(
            ['alice' => 5, 'bob' => 5, 'carol' => 2, 'dave' => 1],
            Player::query()->where('event_id', $event->event_id)->orderBy('name')
                ->pluck('rank_points', 'name')->all(),
        );
        self::assertSame(
            ['alice' => 2, 'bob' => 2],
            TrickCollectionReward::query()->where('event_id', $event->event_id)
                ->where('reward_type', 'rank_distribution')
                ->orderBy('player_name')->pluck('points_delta', 'player_name')->all(),
        );
        self::assertSame(['alice' => 1], TrickCollectionReward::query()
            ->where('event_id', $event->event_id)->where('reward_type', 'taker_remainder')
            ->pluck('points_delta', 'player_name')->all());
        self::assertSame(['alice'], TrickCardHolder::query()->where('event_id', $event->event_id)->orderBy('player_name')
            ->pluck('player_name')->all());
        $publicCollectLog = collect(app(TrickStateService::class)->logs($event->fresh()))
            ->last(fn (array $log) => $log['event'] === 'collect');
        self::assertSame('alice', $publicCollectLog['top_user_id']);
        self::assertSame($card->deck->title, $publicCollectLog['card_title']);
        self::assertSame($card->deck->rule_name, $publicCollectLog['rule_name']);
    }

    public function test_four_point_collection_reduces_lower_ranks_before_the_winner(): void
    {
        [$event, $card] = $this->fixture(['alice', 'bob', 'carol'], [
            'rarity' => 1, 'difficulty' => 2, 'stack_count' => 2, 'taker' => 'alice',
        ]);
        foreach (['alice' => 100, 'bob' => 80, 'carol' => 60] as $player => $score) {
            app(TrickRecordService::class)->saved($this->record($card, $player, $score));
        }
        self::assertSame(2, $card->fresh()->paid_points_total);
        app(TrickCollectionService::class)->collect($event, $card->deck_id, true);
        $rewards = TrickCollectionReward::query()->where('event_card_id', $card->id)->get();
        self::assertSame(4, $rewards->sum('points_delta'));
        self::assertSame(4, $rewards->where('player_name', 'alice')->sum('points_delta'));
        self::assertSame(0, $rewards->where('player_name', 'bob')->sum('points_delta'));
        self::assertSame(0, $rewards->where('player_name', 'carol')->sum('points_delta'));
    }

    public function test_tied_group_remainder_is_returned_to_the_taker(): void
    {
        [$event, $card] = $this->fixture(['alice', 'bob'], [
            'rarity' => 1,
            'difficulty' => 2,
            'stack_count' => 4,
            'taker' => 'alice',
        ]);
        $records = app(TrickRecordService::class);
        $records->saved($this->record($card, 'alice', 100));
        $records->saved($this->record($card, 'bob', 100));

        app(TrickCollectionService::class)->collect($event, $card->deck_id, true);
        self::assertSame(6, (int) TrickCollectionReward::query()
            ->where('event_id', $event->event_id)->sum('points_delta'));
        self::assertFalse(TrickCollectionReward::query()->where('event_id', $event->event_id)
            ->where('reward_type', 'taker_remainder')->exists());
        self::assertSame(11, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('draw_points'));
        self::assertSame(13, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'bob')->value('draw_points'));
    }

    public function test_tied_first_holder_is_the_first_player_to_register_the_top_score(): void
    {
        [$event, $card] = $this->fixture(['alice', 'bob']);
        $records = app(TrickRecordService::class);
        $bob = $this->record($card, 'bob', 100);
        $alice = $this->record($card, 'alice', 100);
        $records->saved($bob);
        $records->saved($alice);
        $bob->update(['created_at' => '2026-07-20 12:05:00']);
        $alice->update(['created_at' => '2026-07-20 12:00:00']);

        app(TrickCollectionService::class)->collect($event, $card->deck_id, true);

        self::assertSame(['bob'], TrickCardHolder::query()->where('event_id', $event->event_id)
            ->pluck('player_name')->all());
        $collectLog = collect(app(TrickStateService::class)->logs($event->fresh()))
            ->firstWhere('event', 'collect');
        self::assertSame('bob', $collectLog['top_user_id']);
        self::assertSame(['alice' => 3, 'bob' => 3], Player::query()->where('event_id', $event->event_id)
            ->orderBy('name')->pluck('rank_points', 'name')->all());
    }

    public function test_subsidy_slots_use_current_resources_and_ignore_legacy_flags(): void
    {
        [$event] = $this->fixture(['alice', 'bob', 'carol']);
        Player::query()->where('event_id', $event->event_id)->update([
            'created_at' => '2026-07-20 08:00:00',
            'subsidy_flag' => true,
            'subsidy_flag_slot_at' => '2026-07-20 09:30:00',
        ]);
        Player::query()->where('name', 'alice')->update(['draw_points' => 1, 'card_count' => 1]);
        Player::query()->where('name', 'bob')->update(['draw_points' => 2, 'card_count' => 1]);
        Player::query()->where('name', 'carol')->update(['draw_points' => -2, 'card_count' => 0]);
        $event->update(['debug_now' => '2026-07-20 09:00:00']);
        $subsidies = app(TrickSubsidyService::class);

        self::assertSame(2, $subsidies->processCurrent($event->fresh())['paid']);
        self::assertSame(0, $subsidies->processCurrent($event->fresh())['paid']);
        self::assertSame(2, Player::query()->where('name', 'alice')->value('draw_points'));
        self::assertSame(2, Player::query()->where('name', 'bob')->value('draw_points'));
        self::assertSame(-1, Player::query()->where('name', 'carol')->value('draw_points'));
        $publicLogs = collect(app(TrickStateService::class)->logs($event->fresh()))->where('event', 'subsidy_paid');
        self::assertCount(1, $publicLogs);
        self::assertSame(2, $publicLogs->first()['subsidy_recipient_count']);
        self::assertFalse(app(TrickStateService::class)->snapshot($event->fresh(), 'alice')['me']['subsidy_flag']);
        self::assertTrue(app(TrickStateService::class)->snapshot($event->fresh(), 'carol')['me']['subsidy_flag']);

        $event->update(['debug_now' => '2026-07-20 09:30:00']);
        self::assertSame(1, $subsidies->processCurrent($event->fresh())['paid']);
        self::assertSame(0, Player::query()->where('name', 'carol')->value('draw_points'));
        // A participant joining after the slot must wait until the next one.
        Player::query()->where('name', 'bob')->update(['draw_points' => 0, 'created_at' => '2026-07-20 09:31:00']);
        $event->update(['debug_now' => '2026-07-20 10:00:00']);
        self::assertSame(2, $subsidies->processCurrent($event->fresh())['paid']);
    }

    public function test_empty_field_does_not_reopen_an_already_processed_subsidy_slot(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        $event->update(['debug_now' => '2026-07-20 09:00:00']);
        Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->update([
            'draw_points' => 5,
            'subsidy_flag' => false,
            'subsidy_flag_slot_at' => null,
            'created_at' => '2026-07-20 08:00:00',
        ]);
        $subsidies = app(TrickSubsidyService::class);
        self::assertSame(0, $subsidies->processCurrent($event->fresh())['paid']);

        $card->update(['state' => '_collected']);
        $event->update(['debug_now' => '2026-07-20 09:10:00']);
        self::assertSame(0, $subsidies->processCurrent($event->fresh())['paid']);
        self::assertSame(5, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('draw_points'));
    }

    public function test_balance_tax_is_collected_after_subsidy_and_added_to_pot_once(): void
    {
        [$event] = $this->fixture(['alice', 'bob']);
        Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->update([
            'draw_points' => 11,
            'take_count' => 0,
            'created_at' => '2026-07-20 08:00:00',
        ]);
        Player::query()->where('event_id', $event->event_id)->where('name', 'bob')->update([
            'draw_points' => 10,
            'take_count' => 0,
            'created_at' => '2026-07-20 08:00:00',
        ]);
        $event->update(['debug_now' => '2026-07-20 12:00:00']);

        $first = app(TrickSubsidyService::class)->processCurrent($event->fresh());
        $second = app(TrickSubsidyService::class)->processCurrent($event->fresh());

        self::assertSame(1, $first['taxed']);
        self::assertSame(0, $second['taxed'] ?? 0);
        self::assertSame(10, Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->value('draw_points'));
        self::assertSame(10, Player::query()->where('event_id', $event->event_id)->where('name', 'bob')->value('draw_points'));
        self::assertSame(1, (int) $event->fresh()->pot_points);
        self::assertSame(1, LimitLog::query()->where('event_id', $event->event_id)
            ->where('event', 'balance_tax_collected')->count());
    }

    public function test_pot_is_used_by_next_scored_collection_and_not_by_empty_collection(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        $event->update(['pot_points' => 4]);
        app(TrickRecordService::class)->saved($this->record($card, 'alice', 100));

        app(TrickCollectionService::class)->collect($event->fresh(), $card->deck_id, true);

        self::assertSame(0, (int) $event->fresh()->pot_points);
        self::assertSame(9, TrickCollectionReward::query()->where('event_id', $event->event_id)->sum('points_delta'));

        $empty = $this->eventCard($event, '_field', 930080, 7280);
        $event->update(['pot_points' => 3]);
        app(TrickCollectionService::class)->collect($event->fresh(), $empty->deck_id, true);
        self::assertSame(3, (int) $event->fresh()->pot_points);
    }

    public function test_return_fee_enters_pot_and_hand_limit_blocks_draw(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        $card->update(['state' => 'alice']);
        Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->update(['card_count' => 1]);

        app(TrickGameService::class)->returnToDeck($event->fresh(), 'alice', $card->deck_id);
        self::assertSame(1, (int) $event->fresh()->pot_points);

        $handCards = [];
        foreach (range(1, 6) as $index) {
            $handCards[] = $this->eventCard($event, 'alice', 930100 + $index, 7300 + $index);
        }
        $deckCard = $this->eventCard($event, '_deck', 930120, 7320);
        Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->update([
            'draw_points' => 10,
            'card_count' => 6,
            'take_count' => 0,
        ]);

        try {
            app(TrickGameService::class)->draw($event->fresh(), 'alice');
            self::fail('手札上限以上のドローは拒否される必要があります');
        } catch (\Illuminate\Http\Exceptions\HttpResponseException $exception) {
            self::assertSame(422, $exception->getResponse()->getStatusCode());
        }
        self::assertSame('_deck', $deckCard->fresh()->state);
        self::assertSame(10, Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->value('draw_points'));
        self::assertCount(6, $handCards);
    }

    public function test_recurring_subsidy_stops_at_combined_three_without_persisting_action_flag(): void
    {
        [$event, $card] = $this->fixture(['alice', 'bob', 'carol', 'dave', 'erin']);
        $card->update(['state' => '_collected']);
        $event->update(['debug_now' => '2026-07-20 09:00:00']);
        Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->update([
            'draw_points' => 1,
            'subsidy_flag' => true,
            'subsidy_flag_slot_at' => '2026-07-20 09:00:00',
        ]);
        $subsidies = app(TrickSubsidyService::class);

        self::assertSame(1, $subsidies->processCurrent($event->fresh())['paid']);
        $alice = Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->firstOrFail();
        self::assertSame(2, $alice->draw_points);
        self::assertFalse($alice->subsidy_flag);
        self::assertNull($alice->subsidy_flag_slot_at);
        self::assertTrue(app(TrickStateService::class)->snapshot($event->fresh(), 'alice')['me']['subsidy_flag']);

        $event->update(['debug_now' => '2026-07-20 09:30:00']);
        self::assertSame(1, $subsidies->processCurrent($event->fresh())['paid']);
        $alice = $alice->fresh();
        self::assertSame(3, $alice->draw_points);
        self::assertFalse($alice->subsidy_flag);
        self::assertNull($alice->subsidy_flag_slot_at);
        self::assertFalse(app(TrickStateService::class)->snapshot($event->fresh(), 'alice')['me']['subsidy_flag']);
        $event->update(['debug_now' => '2026-07-20 10:00:00']);
        self::assertSame(0, $subsidies->processCurrent($event->fresh())['paid']);
    }

    public function test_event_finalization_collects_empty_field_and_releases_unheld_cards(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        app(TrickRecordService::class)->saved($this->record($card, 'alice', 100));
        $empty = $this->eventCard($event, '_field', 930003, 7203);
        $unused = $this->eventCard($event, '_deck', 930002, 7202);
        $event->update(['debug_now' => $event->end_at]);

        $result = app(TrickEventFinalizer::class)->finalize($event->fresh());
        self::assertTrue($result['ended_now']);
        self::assertSame(2, $result['collected']);
        self::assertSame('ended', $event->fresh()->state);
        self::assertSame('_collected', $card->fresh()->state);
        self::assertSame('_collected', $empty->fresh()->state);
        self::assertSame(1, TrickCardHolder::query()->where('event_id', $event->event_id)->count());
        self::assertSame(0, TrickCollectionReward::query()->where('event_card_id', $empty->id)->count());
        self::assertSame('_held', $card->deck->fresh()->state);
        self::assertSame('_eligible', $empty->deck->fresh()->state);
        self::assertSame('_eligible', $unused->deck->fresh()->state);
        $snapshot = app(TrickStateService::class)->snapshot($event->fresh(), 'alice');
        self::assertSame([], $snapshot['field']);
        self::assertSame([], $snapshot['hand']);
        self::assertSame(0, $snapshot['deck_count']);
        self::assertFalse(app(TrickEventFinalizer::class)->finalize($event->fresh())['ended_now']);
        self::assertSame(1, LimitLog::query()->where('event_id', $event->event_id)->where('event', 'event_ended')->count());
    }

    public function test_expired_collection_rejects_early_cards_and_collects_at_limit(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        $card->update(['limit_at' => $event->debug_now->addMinute()]);
        try {
            app(TrickCollectionService::class)->collect($event, $card->deck_id);
            self::fail('期限前の通常回収は拒否される必要があります');
        } catch (\Illuminate\Http\Exceptions\HttpResponseException $exception) {
            self::assertSame(422, $exception->getResponse()->getStatusCode());
        }
        self::assertSame('_field', $card->fresh()->state);

        $event->update(['debug_now' => $event->debug_now->addMinute()]);
        $result = app(TrickCollectionService::class)->collectExpired($event->fresh());
        self::assertSame(1, $result['count']);
        self::assertSame('_collected', $card->fresh()->state);
    }

    public function test_natural_collection_does_not_create_one_shot_subsidy(): void
    {
        [$event, $card] = $this->fixture(['alice', 'bob', 'carol']);
        app(TrickRecordService::class)->saved($this->record($card, 'alice', 100));
        Player::query()->where('event_id', $event->event_id)->where('name', 'alice')
            ->update(['draw_points' => -5]);
        $event->update(['debug_now' => $card->fresh()->limit_at]);

        $result = app(TrickCollectionService::class)->collectExpired($event->fresh());

        self::assertSame(1, $result['count']);
        self::assertSame(0, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('draw_points'));
        self::assertFalse((bool) Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('subsidy_flag'));
        $collectLog = collect(app(TrickStateService::class)->logs($event->fresh()))
            ->firstWhere('event', 'collect');
        self::assertSame('alice', $collectLog['top_user_id']);

        $event->update(['debug_now' => $event->debug_now->setMinute(30)]);
        self::assertSame(1, app(TrickSubsidyService::class)->processCurrent($event->fresh())['paid']);
        self::assertSame(1, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('draw_points'));
        $subsidyLog = collect(app(TrickStateService::class)->logs($event->fresh()))
            ->firstWhere('event', 'subsidy_paid');
        self::assertSame('alice', $subsidyLog['affected_player_name']);
    }

    public function test_collection_apis_require_signed_admin_and_collected_is_public(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        app(TrickRecordService::class)->saved($this->record($card, 'alice', 100));
        putenv('TRICKS_EVENT_ID='.$event->event_id);
        putenv('TRICKS_INTERNAL_SECRET=phase-four-secret');
        try {
            $path = '/api/tricks/cards/'.$card->deck_id.'/collect';
            $this->postJson($path)->assertStatus(401);
            $this->withHeaders($this->signedHeaders('alice', 0))->postJson($path)->assertStatus(403);
            $this->withHeaders($this->signedHeaders('admin', 10))->postJson($path)->assertOk()
                ->assertJsonPath('collected_now', true);
            $this->getJson('/api/tricks/collected?event_id='.$event->event_id)->assertOk()
                ->assertJsonPath('0.holders.0', 'alice')
                ->assertJsonPath('0.returns_next_event', false)
                ->assertJsonPath('0.rankings.0.user_id', 'alice');
        } finally {
            putenv('TRICKS_EVENT_ID');
            putenv('TRICKS_INTERNAL_SECRET');
        }
    }

    public function test_participant_can_trigger_idempotent_maintenance_endpoints(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        $card->update(['limit_at' => $event->debug_now->subMinute()]);
        putenv('TRICKS_EVENT_ID='.$event->event_id);
        putenv('TRICKS_INTERNAL_SECRET=phase-four-secret');
        try {
            $this->postJson('/api/tricks/maintenance/collect-expired')->assertStatus(401);
            $this->withHeaders($this->signedHeaders('alice', 0))
                ->postJson('/api/tricks/maintenance/collect-expired')
                ->assertOk()
                ->assertJsonPath('count', 1);
            $this->withHeaders($this->signedHeaders('alice', 0))
                ->postJson('/api/tricks/maintenance/collect-expired')
                ->assertOk()
                ->assertJsonPath('count', 0);
            $this->withHeaders($this->signedHeaders('alice', 0))
                ->postJson('/api/tricks/maintenance/subsidy')
                ->assertOk();
            self::assertSame('_collected', $card->fresh()->state);
        } finally {
            putenv('TRICKS_EVENT_ID');
            putenv('TRICKS_INTERNAL_SECRET');
        }
    }

    public function test_player_extension_costs_one_point_and_is_idempotent(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        $card->update(['limit_at' => $event->debug_now->addMinutes(30)]);
        $game = app(TrickGameService::class);

        $first = $game->extend($event, 'alice', $card->deck_id, 'extend-test-0001');
        self::assertTrue($first['extended']);
        self::assertFalse($first['idempotent_replay']);
        self::assertTrue($card->fresh()->limit_at->equalTo($event->debug_now->addMinutes(45)));
        self::assertSame(9, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('draw_points'));
        self::assertSame(1, $card->fresh()->paid_points_total);

        $replay = $game->extend($event, 'alice', $card->deck_id, 'extend-test-0001');
        self::assertFalse($replay['extended']);
        self::assertTrue($replay['idempotent_replay']);
        self::assertSame(9, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('draw_points'));
        self::assertSame(1, LimitLog::query()->where('event_id', $event->event_id)
            ->where('event', 'player_extension')->count());
    }

    public function test_non_taker_without_a_post_can_extend_and_live_reward_includes_the_payment(): void
    {
        [$event, $card] = $this->fixture(['alice', 'bob'], ['rarity' => 3]);
        $card->update(['limit_at' => $event->debug_now->addMinutes(30)]);
        $before = app(TrickStateService::class)->snapshot($event->fresh(), 'bob');
        self::assertTrue($before['field'][0]['my_can_extend']);
        self::assertSame(8, $before['field'][0]['live_total_reward']);

        app(TrickGameService::class)->extend($event, 'bob', $card->deck_id, 'extend-bob-0001');

        $after = app(TrickStateService::class)->snapshot($event->fresh(), 'bob');
        self::assertSame(9, $after['field'][0]['live_total_reward']);
        self::assertSame(9, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'bob')->value('draw_points'));
        self::assertFalse(app(TrickStateService::class)->snapshot($event->fresh(), 'outsider')['field'][0]['my_can_extend']);
    }

    public function test_extension_flag_matches_end_limit_and_rejection_does_not_charge(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        foreach ([-1, 0, 15] as $minutes) {
            $card->update(['limit_at' => $event->end_at->copy()->addMinutes($minutes)]);
            self::assertSame($minutes < 0, app(TrickStateService::class)->snapshot($event, 'alice')['field'][0]['my_can_extend']);
            if ($minutes >= 0) {
                try {
                    app(TrickGameService::class)->extend($event, 'alice', $card->deck_id, 'end-limit-'.$minutes);
                    self::fail('終了時刻以上の期限は延長不可');
                } catch (\Illuminate\Http\Exceptions\HttpResponseException $exception) {
                    self::assertSame(409, $exception->getResponse()->getStatusCode());
                }
            }
        }
        self::assertSame(10, Player::query()->where('event_id', $event->event_id)->where('name', 'alice')->value('draw_points'));
        self::assertSame(0, $card->fresh()->paid_points_total);
    }

    public function test_player_extension_is_rejected_during_the_final_hour_without_charging(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        $event->update(['debug_now' => $event->end_at->subHour()]);
        $card->update(['limit_at' => $event->end_at]);

        try {
            app(TrickGameService::class)->extend($event->fresh(), 'alice', $card->deck_id, 'extend-test-0002');
            self::fail('大会終了1時間前以降の任意延長は拒否される必要があります');
        } catch (\Illuminate\Http\Exceptions\HttpResponseException $exception) {
            self::assertSame(403, $exception->getResponse()->getStatusCode());
        }
        self::assertSame(10, Player::query()->where('event_id', $event->event_id)
            ->where('name', 'alice')->value('draw_points'));
        self::assertSame(0, $card->fresh()->paid_points_total);
    }

    public function test_empty_field_emergency_grant_tops_up_every_player_and_logs_total(): void
    {
        [$event, $card] = $this->fixture(['alice', 'bob']);
        Player::query()->where('event_id', $event->event_id)->where('name', 'alice')
            ->update(['draw_points' => 0, 'card_count' => 0]);
        Player::query()->where('event_id', $event->event_id)->where('name', 'bob')
            ->update(['draw_points' => 1, 'card_count' => 1]);

        app(TrickCollectionService::class)->collect($event, $card->deck_id, true);

        self::assertSame('_collected', $card->fresh()->state);
        self::assertSame(
            ['alice' => 3, 'bob' => 2],
            Player::query()->where('event_id', $event->event_id)->orderBy('name')
                ->pluck('draw_points', 'name')->all(),
        );
        $grantLog = LimitLog::query()->where('event_id', $event->event_id)
            ->where('event', 'empty_field_floor_grant')->firstOrFail();
        self::assertSame(4, $grantLog->points_delta);
        self::assertSame(4, $grantLog->context['total_points']);
        self::assertSame(4, collect(app(TrickStateService::class)->logs($event))
            ->firstWhere('event', 'empty_field_floor_grant')['granted_points_total']);
    }

    public function test_three_players_can_score_collect_and_continue_with_another_taker(): void
    {
        [$event, $firstCard] = $this->fixture(['alice', 'bob', 'carol'], [
            'stack_count' => 3,
            'taker' => 'alice',
        ]);
        $firstCard->update(['limit_at' => $event->debug_now->addMinute()]);
        $records = app(TrickRecordService::class);
        foreach (['alice' => 300, 'bob' => 200, 'carol' => 100] as $player => $score) {
            $records->saved($this->record($firstCard, $player, $score));
        }

        $event->update(['debug_now' => $firstCard->fresh()->limit_at]);
        self::assertSame(1, app(TrickCollectionService::class)->collectExpired($event->fresh())['count']);

        $bobHand = collect([
            $this->eventCard($event->fresh(), 'bob', 930011, 7211),
            $this->eventCard($event->fresh(), 'bob', 930012, 7212),
            $this->eventCard($event->fresh(), 'bob', 930013, 7213),
        ]);
        Player::query()->where('event_id', $event->event_id)->where('name', 'bob')
            ->update(['card_count' => 3]);
        $secondTake = app(TrickGameService::class)->take($event->fresh(), 'bob', $bobHand->first()->deck_id);
        self::assertSame('bob', $secondTake['card']['taker']);
        self::assertSame(3, $secondTake['card']['stack_count']);

        $secondCard = TrickEventCard::query()->whereKey($secondTake['card']['event_card_id'])->firstOrFail();
        foreach (['bob' => 300, 'carol' => 200, 'alice' => 100] as $player => $score) {
            $records->saved($this->record($secondCard, $player, $score));
        }
        $event->update(['debug_now' => $secondCard->fresh()->limit_at]);
        self::assertSame(1, app(TrickCollectionService::class)->collectExpired($event->fresh())['count']);

        self::assertSame(
            ['alice' => 5, 'bob' => 6, 'carol' => 3],
            Player::query()->where('event_id', $event->event_id)->orderBy('name')
                ->pluck('rank_points', 'name')->all(),
        );
        self::assertTrue(Player::query()->where('event_id', $event->event_id)
            ->where('draw_points', '>', 0)->exists());
        self::assertSame(2, TrickEventCard::query()->where('event_id', $event->event_id)
            ->where('state', '_collected')->count());
    }

    public function test_take_grants_one_point_based_on_resources_before_consuming_hand(): void
    {
        [$event, $existing] = $this->fixture(['alice']);
        $existing->update(['state' => '_collected']);
        $first = $this->eventCard($event, 'alice', 940001, 7301);
        $this->eventCard($event, 'alice', 940002, 7302);
        Player::query()->where('name', 'alice')->update(['draw_points' => 2, 'card_count' => 2]);

        $result = app(TrickGameService::class)->take($event, 'alice', $first->deck_id);

        self::assertSame(3, $result['player']['draw_points']);
        self::assertSame(0, $result['player']['card_count']);
        self::assertFalse($result['player']['subsidy_flag']);
        self::assertSame(1, LimitLog::query()->where('event', 'instant_subsidy_paid')->count());
        self::assertSame(1, collect(app(TrickStateService::class)->logs($event))
            ->where('event', 'instant_subsidy_paid')->count());
    }

    public function test_take_at_five_resources_does_not_grant_after_consuming_hand(): void
    {
        [$event, $existing] = $this->fixture(['alice']);
        $existing->update(['state' => '_collected']);
        $first = $this->eventCard($event, 'alice', 940001, 7301);
        $this->eventCard($event, 'alice', 940002, 7302);
        Player::query()->where('name', 'alice')->update(['draw_points' => 3, 'card_count' => 2]);

        $result = app(TrickGameService::class)->take($event, 'alice', $first->deck_id);

        self::assertSame(3, $result['player']['draw_points']);
        self::assertFalse($result['player']['subsidy_flag']);
        self::assertSame(0, LimitLog::query()->where('event', 'instant_subsidy_paid')->count());
    }

    public function test_free_post_grant_is_once_per_player_and_card_and_clears_recurring_flag(): void
    {
        [$event, $card] = $this->fixture(['alice', 'bob']);
        Player::query()->where('name', 'bob')->update(['draw_points' => 2]);
        $records = app(TrickRecordService::class);
        $record = $this->record($card, 'bob', 100);
        $records->saved($record);
        self::assertSame(3, Player::query()->where('name', 'bob')->value('draw_points'));
        self::assertFalse(app(TrickStateService::class)->snapshot($event, 'bob')['me']['subsidy_flag']);
        $records->saved($record);
        self::assertSame(3, Player::query()->where('name', 'bob')->value('draw_points'));
        self::assertSame(1, LimitLog::query()->where('event', 'instant_subsidy_paid')->count());

        $record->update(['flg' => 2]);
        $records->deleted($record->fresh());
        $records->saved($this->record($card, 'bob', 110));
        self::assertSame(1, LimitLog::query()->where('event', 'instant_subsidy_paid')->count());
        self::assertSame(1, Player::query()->where('name', 'bob')->value('draw_points'));
    }

    public function test_free_post_uses_strict_combined_five_threshold(): void
    {
        [$event, $card] = $this->fixture(['alice', 'bob', 'carol', 'dave']);
        Player::query()->where('name', 'bob')->update(['draw_points' => 4]);
        Player::query()->where('name', 'carol')->update(['draw_points' => 5]);
        Player::query()->where('name', 'dave')->update(['draw_points' => 2, 'card_count' => 3]);
        $records = app(TrickRecordService::class);
        foreach (['bob', 'carol', 'dave'] as $name) {
            $records->saved($this->record($card, $name, 100));
        }
        self::assertSame(5, Player::query()->where('name', 'bob')->value('draw_points'));
        self::assertSame(5, Player::query()->where('name', 'carol')->value('draw_points'));
        self::assertSame(2, Player::query()->where('name', 'dave')->value('draw_points'));
        self::assertSame(1, LimitLog::query()->where('event', 'instant_subsidy_paid')->count());
    }

    public function test_paid_taker_post_has_no_instant_grant_and_negative_resources_are_recurring(): void
    {
        [$event, $card] = $this->fixture(['alice']);
        Player::query()->where('name', 'alice')->update(['draw_points' => 1]);
        app(TrickRecordService::class)->saved($this->record($card, 'alice', 100));
        self::assertSame(-1, Player::query()->where('name', 'alice')->value('draw_points'));
        self::assertSame(0, LimitLog::query()->where('event', 'instant_subsidy_paid')->count());
        self::assertTrue(app(TrickStateService::class)->snapshot($event, 'alice')['me']['subsidy_flag']);
    }

    public function test_instant_grant_below_three_keeps_recurring_eligibility_at_next_slot(): void
    {
        [$event, $card] = $this->fixture(['alice', 'bob']);
        Player::query()->where('name', 'bob')->update(['draw_points' => 1]);
        app(TrickRecordService::class)->saved($this->record($card, 'bob', 100));
        self::assertSame(2, Player::query()->where('name', 'bob')->value('draw_points'));
        self::assertTrue(app(TrickStateService::class)->snapshot($event, 'bob')['me']['subsidy_flag']);
        $event->update(['debug_now' => $event->debug_now->addMinutes(30)]);
        $subsidies = app(TrickSubsidyService::class);
        self::assertSame(1, $subsidies->processCurrent($event->fresh())['paid']);
        self::assertSame(0, $subsidies->processCurrent($event->fresh())['paid']);
        self::assertSame(3, Player::query()->where('name', 'bob')->value('draw_points'));
        self::assertFalse(app(TrickStateService::class)->snapshot($event->fresh(), 'bob')['me']['subsidy_flag']);
    }

    /** @return array{0: TrickEvent, 1: TrickEventCard} */
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
                'phase-four-secret',
            ),
        ];
    }
}
