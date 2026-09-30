<?php

namespace Tests\Feature\Tricks;

use App\Models\Deck;
use App\Models\Player;
use App\Models\Record;
use App\Models\TrickEvent;
use App\Services\Tricks\TrickGameService;
use App\Services\Tricks\TrickLegacyMigrationService;
use App\Services\Tricks\TrickTestFixtureService;
use Carbon\CarbonImmutable;
use Database\Seeders\TrickDummyDeckSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrickPhaseSixTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        putenv('TRICKS_INTERNAL_SECRET=phase-six-secret');
    }

    protected function tearDown(): void
    {
        putenv('TRICKS_INTERNAL_SECRET');
        parent::tearDown();
    }

    public function test_signed_fixture_is_isolated_selectable_and_tears_down_to_zero(): void
    {
        $eventId = 990061;
        $headers = $this->testHeaders('playwright-admin', $eventId);
        $created = $this->withHeaders($headers)->postJson('/api/tricks/debug/fixtures', [
            'event_id' => $eventId,
            'random_seed' => 6061,
            'players' => [
                ['name' => 'alice', 'points' => 12, 'hand_count' => 3],
                ['name' => 'bob', 'points' => 8],
                ['name' => 'carol', 'points' => 9, 'hand_count' => 3],
            ],
            'field_player' => 'alice',
        ]);
        $created->assertCreated()
            ->assertJsonPath('counts.events', 1)
            ->assertJsonPath('counts.decks', 160)
            ->assertJsonPath('counts.event_cards', 160)
            ->assertJsonPath('counts.players', 3)
            ->assertJsonPath('counts.stages', 1);

        $this->withHeaders($this->testHeaders('alice', $eventId))->getJson('/api/tricks/state')
            ->assertOk()
            ->assertJsonPath('tournament.event_id', $eventId)
            ->assertJsonPath('me.name', 'alice')
            ->assertJsonPath('me.points', 12)
            ->assertJsonPath('me.collected_card_count', 0)
            ->assertJsonPath('collected_count', 0)
            ->assertJsonCount(0, 'hand')
            ->assertJsonCount(1, 'field');
        $this->withHeaders($this->testHeaders('carol', $eventId))->getJson('/api/tricks/state')
            ->assertOk()->assertJsonCount(3, 'hand');

        $teardown = $this->withHeaders($headers)
            ->postJson("/api/tricks/debug/fixtures/{$eventId}/teardown");
        $teardown->assertOk();
        self::assertSame([
            'events' => 0,
            'decks' => 0,
            'event_cards' => 0,
            'players' => 0,
            'logs' => 0,
            'records' => 0,
            'stages' => 0,
        ], $teardown->json('counts'));
    }

    public function test_test_signature_cannot_select_a_normal_event(): void
    {
        $now = CarbonImmutable::parse('2026-07-20 12:00:00');
        TrickEvent::query()->create([
            'event_id' => 990062,
            'title' => 'normal event',
            'start_at' => $now->subHour(),
            'end_at' => $now->addHour(),
            'state' => 'active',
            'debug' => true,
            'test_mode' => false,
            'initialized_at' => $now,
        ]);

        $this->withHeaders($this->testHeaders('mallory', 990062))->getJson('/api/tricks/state')->assertNotFound();
    }

    public function test_legacy_migration_reports_dry_run_and_is_idempotent(): void
    {
        $start = CarbonImmutable::parse('2026-07-01 00:00:00');
        $event = TrickEvent::query()->create([
            'event_id' => 990063,
            'title' => 'legacy event',
            'start_at' => $start,
            'end_at' => $start->addDays(2),
            'state' => 'ended',
            'ended_at' => $start->addDays(2),
        ]);
        $deck = Deck::query()->create([
            'eventId' => $event->event_id,
            'event_id' => $event->event_id,
            'stageId' => 399,
            'stage_id' => 9963,
            'origin_stage_id' => 399,
            'title' => 'legacy card',
            'ruleName' => 'legacy rule',
            'rule_name' => 'legacy rule',
            'state' => '_collected',
            'text' => 'legacy',
            'difficulty' => 3,
            'rarity' => 2,
            'rewards' => 3,
            'topPlayer' => 'alice',
            'top_player' => 'alice',
        ]);
        $record = Record::query()->create([
            'user_id' => 'alice',
            'score' => 123,
            'stage_id' => 9963,
            'rule' => 1,
            'console' => 1,
            'difficulty' => 3,
            'region' => '1',
            'team' => 0,
            'unique_id' => 99006301,
            'post_comment' => '',
            'user_ip' => '',
            'user_host' => '',
            'user_agent' => '',
            'img_url' => '',
            'video_url' => '',
            'post_memo' => '',
            'flg' => 0,
        ]);
        $record->forceFill(['created_at' => $start->addHour(), 'updated_at' => $start->addHour()])->save();

        $migration = app(TrickLegacyMigrationService::class);
        self::assertSame(1, $migration->inspect($event)['event_cards_to_create']);
        $first = $migration->migrate($event);
        self::assertSame(1, $first['created']['event_cards']);
        self::assertSame(1, $first['created']['record_links']);
        self::assertSame(1, $first['created']['payments']);
        self::assertSame(1, $first['created']['holders']);
        self::assertSame(0, $migration->migrate($event)['created']['event_cards']);
        self::assertSame('_collected', $deck->eventCards()->where('event_id', $event->event_id)->value('state'));
    }

    public function test_dummy_seeder_creates_200_eligible_cards_without_mutating_players(): void
    {
        $player = Player::query()->create([
            'event_id' => 990064,
            'name' => 'seeder-sentinel',
            'draw_points' => 7,
        ]);
        $this->seed(TrickDummyDeckSeeder::class);

        self::assertSame(200, Deck::query()->where('creator', 'codex_dummy')->count());
        self::assertSame(200, Deck::query()->where('creator', 'codex_dummy')->where('state', '_eligible')->count());
        self::assertSame(7, $player->fresh()->draw_points);
    }

    public function test_fixture_seed_reproduces_test_mode_rarity_draws(): void
    {
        $fixtures = app(TrickTestFixtureService::class);
        $game = app(TrickGameService::class);
        $rarities = [];
        foreach ([990065, 990066] as $eventId) {
            $fixtures->create($eventId, [
                'random_seed' => 6065,
                'players' => [['name' => 'alice', 'points' => 5]],
            ]);
            $event = TrickEvent::query()->where('event_id', $eventId)->firstOrFail();
            $rarities[] = $game->draw($event, 'alice')['card']['rarity'];
            $fixtures->teardown($eventId);
        }

        self::assertSame($rarities[0], $rarities[1]);
    }

    private function testHeaders(string $userId, int $eventId): array
    {
        $timestamp = (string) time();
        $role = '10';
        $kind = 'test';

        return [
            'x-tricks-user' => $userId,
            'x-tricks-role' => $role,
            'x-tricks-identity-kind' => $kind,
            'x-tricks-test-event' => (string) $eventId,
            'x-tricks-timestamp' => $timestamp,
            'x-tricks-signature' => hash_hmac(
                'sha256',
                $timestamp."\n".$userId."\n".$role."\n".$kind."\n".$eventId,
                'phase-six-secret',
            ),
        ];
    }
}
