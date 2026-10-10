<?php

namespace Tests\Feature\Tricks;

use App\Library\Func;
use App\Models\Deck;
use App\Models\Player;
use App\Models\Record;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use App\Services\Tricks\TrickCollectionService;
use App\Services\Tricks\TrickRecordService;
use App\Services\Tricks\TrickStageAllocator;
use App\Services\Tricks\TrickStateService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrickTimeScoreTest extends TestCase
{
    use RefreshDatabase;

    private string $testSecret;

    protected function setUp(): void
    {
        parent::setUp();
        $this->testSecret = bin2hex(random_bytes(32));
        putenv('TRICKS_EVENT_ID=990412');
        putenv('TRICKS_INTERNAL_SECRET='.$this->testSecret);
    }

    protected function tearDown(): void
    {
        putenv('TRICKS_EVENT_ID');
        putenv('TRICKS_INTERNAL_SECRET');
        parent::tearDown();
    }

    /** @dataProvider elapsedTimeOrigins */
    public function test_time_card_uses_integer_seconds_shortest_personal_best_and_shared_ranks(int $originStageId): void
    {
        [$event, $card] = $this->fixture('time', $originStageId);
        $stageId = $card->deck->stage_id;
        self::assertSame(['score', 'ASC'], Func::orderByRule($stageId, 1));
        self::assertSame('time', app(TrickStateService::class)->normalizeCard($card)['score_type']);
        foreach ([['fast', 83], ['slow', 120], ['fast', 95], ['tie', 83]] as [$name, $seconds]) {
            $this->postSeconds($card, $name, $seconds)->assertOk();
        }
        self::assertSame([83, 120, 95, 83], Record::query()->orderBy('post_id')->pluck('score')->map(fn ($score) => (int) $score)->all());
        $rankings = app(TrickRecordService::class)->rankings($card);
        self::assertSame([83, 83, 120], array_column($rankings, 'score'));
        self::assertSame([1, 1, 3], array_column($rankings, 'rank'));
        self::assertSame(['time', 'time', 'time'], array_column($rankings, 'score_type'));
        self::assertSame('fast', $rankings[0]['user_id']);
        $this->postSeconds($card, 'slow', '01:23')->assertStatus(422);
        $this->postSeconds($card, 'slow', 83.5)->assertStatus(422);
        $this->postSeconds($card, 'slow', 0)->assertStatus(422);
        $collected = app(TrickCollectionService::class)->collect($event, $card->deck_id, true);
        self::assertSame([83, 83, 120], array_column($collected['rankings'], 'score'));
        self::assertSame(['time', 'time', 'time'], array_column($collected['rankings'], 'score_type'));
        self::assertSame('time', $collected['card']['score_type']);
    }

    public function test_one_second_is_accepted_and_points_cards_keep_descending_order(): void
    {
        [, $card] = $this->fixture('points');
        self::assertSame(['score', 'DESC'], Func::orderByRule($card->deck->stage_id, 1));
        $this->postSeconds($card, 'fast', 83)->assertOk();
        $this->postSeconds($card, 'slow', 120)->assertOk();
        self::assertSame([120, 83], array_column(app(TrickRecordService::class)->rankings($card), 'score'));
        $card->deck->update(['score_type' => 'time']);
        app(TrickStageAllocator::class)->ensure($card->event, $card->deck->fresh());
        $card->load('deck');
        $this->postSeconds($card, 'tie', 1)->assertOk();
        self::assertSame(1, app(TrickRecordService::class)->rankings($card)[0]['score']);
    }

    /** @dataProvider remainingTimeOrigins */
    public function test_remaining_time_uses_largest_personal_best_and_shared_ranks(int $originStageId, ?int $stageId = null): void
    {
        [$event, $card] = $this->fixture('time', $originStageId);
        if ($stageId !== null) {
            $card->deck->update(['stage_id' => $stageId]);
            app(TrickStageAllocator::class)->ensure($event, $card->deck);
        }
        self::assertSame(['score', 'DESC'], Func::orderByRule($card->deck->stage_id, 1));
        foreach ([['fast', 83], ['slow', 120], ['fast', 95], ['tie', 120]] as [$name, $seconds]) {
            $this->postSeconds($card, $name, $seconds)->assertOk();
        }
        self::assertSame([83, 120, 95, 120], Record::query()->orderBy('post_id')->pluck('score')->map(fn ($score) => (int) $score)->all());
        $rankings = app(TrickRecordService::class)->rankings($card);
        self::assertSame([120, 120, 95], array_column($rankings, 'score'));
        self::assertSame([1, 1, 3], array_column($rankings, 'rank'));
        self::assertSame(['time', 'time', 'time'], array_column($rankings, 'score_type'));
        $collected = app(TrickCollectionService::class)->collect($event, $card->deck_id, true);
        self::assertSame([120, 120, 95], array_column($collected['rankings'], 'score'));
        self::assertSame('time', $collected['card']['score_type']);
    }

    public static function remainingTimeOrigins(): array
    {
        return [...array_map(fn ($id) => [$id], range(419, 428)), [401, 1356]];
    }

    public static function elapsedTimeOrigins(): array
    {
        return [[399], [401], [418], [429]];
    }

    private function fixture(string $type, int $originStageId = 399): array
    {
        $now = CarbonImmutable::parse('2026-10-09 12:00:00', 'Asia/Tokyo');
        $event = TrickEvent::create(['event_id' => 990412, 'title' => 'Time score test', 'start_at' => $now->subHour(), 'end_at' => $now->addHours(47), 'state' => 'active', 'debug' => true, 'test_mode' => true, 'debug_now' => $now, 'initialized_at' => $now]);
        $deck = Deck::create(['eventId' => 990412, 'event_id' => 990412, 'origin_stage_id' => $originStageId, 'card_id' => 990412, 'title' => 'Dummy timer stage', 'rule_name' => 'Clear time', 'text' => 'Shorter elapsed time wins', 'difficulty' => 1, 'state' => '_in_event', 'rewards' => 0, 'score_type' => $type]);
        app(TrickStageAllocator::class)->ensure($event, $deck);
        $card = TrickEventCard::create(['event_id' => 990412, 'deck_id' => $deck->id, 'state' => '_field', 'rarity' => 1, 'difficulty' => 1, 'stack_count' => 3, 'taker' => 'fast', 'taken_at' => $now, 'limit_at' => $now->addMinutes(90)]);
        $card->load('deck');
        foreach (['fast', 'slow', 'tie'] as $name) Player::create(['event_id' => 990412, 'name' => $name, 'draw_points' => 20, 'rank_points' => 0, 'card_count' => 0]);
        return [$event, $card];
    }

    private function postSeconds(TrickEventCard $card, string $name, mixed $score)
    {
        $timestamp = (string) time();
        return $this->withHeaders([
            'x-tricks-user' => $name, 'x-tricks-role' => '0', 'x-tricks-identity-kind' => 'session', 'x-tricks-test-event' => '', 'x-tricks-timestamp' => $timestamp,
            'x-tricks-signature' => hash_hmac('sha256', $timestamp."\n".$name."\n0\nsession\n", $this->testSecret),
        ])->postJson('/api/record', ['user_id' => $name, 'score' => $score, 'stage_id' => $card->deck->stage_id, 'rule' => 1, 'console' => 1, 'difficulty' => 1, 'region' => 1, 'post_comment' => 'dummy time test', 'user_agent' => 'phpunit', 'video_url' => '', 'mode' => 'create']);
    }
}
