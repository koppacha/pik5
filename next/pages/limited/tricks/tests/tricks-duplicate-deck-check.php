<?php
namespace Tests\Feature\Tricks;
use App\Models\{Deck, Player, Record, TrickEvent, TrickEventCard, TrickCardHolder};
use App\Services\Tricks\{TrickGameService, TrickStateService, TrickRecordService, TrickCollectionService, TrickStageAllocator};
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
class TrickDuplicateDeckCheckTest extends TestCase
{
    use RefreshDatabase;
    private function event(): TrickEvent
    {
        $now = CarbonImmutable::parse('2026-10-10 12:00:00', 'Asia/Tokyo');
        $event = TrickEvent::create(['event_id' => 990880, 'title' => 'Synthetic duplicate audit',
            'start_at' => $now->subHour(), 'end_at' => $now->addHours(30), 'state' => 'active',
            'debug' => true, 'test_mode' => true, 'debug_now' => $now, 'initialized_at' => $now]);
        foreach (['alice', 'bob', 'carol'] as $name) Player::create(['event_id' => $event->event_id,
            'name' => $name, 'draw_points' => 100, 'rank_points' => 0, 'card_count' => 0, 'take_count' => 0]);
        return $event;
    }
    private function card(TrickEvent $event, string $type = 'points', ?int $stage = null): TrickEventCard
    {
        $deck = Deck::create(['eventId' => $event->event_id, 'event_id' => null, 'stage_id' => $stage,
            'origin_stage_id' => 401, 'title' => 'Identical title', 'rule_name' => 'Identical rule',
            'text' => 'Identical synthetic rule', 'creator' => 'Synthetic creator', 'difficulty' => 2,
            'score_type' => $type, 'state' => '_in_event', 'rewards' => 0, 'count' => 0]);
        $deck->update(['card_id' => $deck->id]);
        return TrickEventCard::create(['event_id' => $event->event_id, 'deck_id' => $deck->id,
            'state' => '_deck', 'difficulty' => 2]);
    }
    private function saveScore(TrickEventCard $card, string $user, int $score): void
    {
        $record = Record::create(['user_id' => $user, 'score' => $score,
            'stage_id' => $card->fresh()->deck->stage_id, 'rule' => 1, 'console' => 1,
            'difficulty' => 2, 'region' => '1', 'team' => 0, 'unique_id' => random_int(100000000, 999999999),
            'post_comment' => 'Synthetic audit', 'user_ip' => '127.0.0.1', 'user_host' => 'localhost',
            'user_agent' => 'phpunit', 'img_url' => '', 'video_url' => '', 'post_memo' => '', 'flg' => 0]);
        app(TrickRecordService::class)->saved($record);
    }
    public function test_320_identical_contents_with_distinct_ids_remain_independent(): void
    {
        $event = $this->event();
        for ($i = 0; $i < 320; $i++) $this->card($event);
        $state = app(TrickStateService::class);
        self::assertSame(320, $state->snapshot($event, null)['deck_count']);
        $game = app(TrickGameService::class);
        $fields = [];
        foreach (['alice', 'bob'] as $name) {
            $first = $game->draw($event, $name);
            $game->draw($event, $name);
            $game->take($event, $name, $first['card']['id']);
            $fields[] = TrickEventCard::where('deck_id', $first['card']['id'])->firstOrFail();
        }
        foreach ($fields as $card) $card->update(['rarity' => 1]);
        self::assertNotSame($fields[0]->deck->stage_id, $fields[1]->deck->stage_id);
        self::assertSame(316, $state->snapshot($event, null)['deck_count']);
        $this->saveScore($fields[0], 'carol', 100);
        self::assertSame([], app(TrickRecordService::class)->rankings($fields[1]));
        $this->saveScore($fields[1], 'carol', 100);
        self::assertSame(2, \App\Models\TrickCardPayment::where('player_name', 'carol')->where('points_paid', 0)->count());
        foreach ($fields as $card) app(TrickCollectionService::class)->collect($event, $card->deck_id, true);
        self::assertSame(2, TrickCardHolder::where('player_name', 'carol')->count());
        self::assertSame(104, Player::where('name', 'carol')->value('draw_points'));
        self::assertSame(2, TrickEventCard::where('state', '_trash')->count());
        self::assertSame(2, TrickEventCard::where('state', '_collected')->count());
    }
    public function test_1356_exception_does_not_follow_a_new_stage_id(): void
    {
        $event = $this->event();
        $orders = [];
        foreach ([1356, 1500] as $id) {
            $card = $this->card($event, 'time', $id);
            app(TrickStageAllocator::class)->ensure($event, $card->deck);
            $card->update(['state' => '_field', 'taker' => 'alice', 'rarity' => 1, 'stack_count' => 2,
                'taken_at' => $event->debug_now, 'limit_at' => $event->debug_now->addHour()]);
            $this->saveScore($card, 'bob', 100);
            $this->saveScore($card, 'carol', 400);
            $orders[$id] = array_column(app(TrickRecordService::class)->rankings($card), 'score');
        }
        self::assertSame([400, 100], $orders[1356]);
        // 現状の瑕疵を再現する検査。新番号は逆順になるため追加前に修正が必要。
        self::assertSame([100, 400], $orders[1500]);
    }
}
