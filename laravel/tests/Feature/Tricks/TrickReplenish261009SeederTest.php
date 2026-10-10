<?php
namespace Tests\Feature\Tricks;
use App\Library\Func;
use App\Models\{Deck, Player, Record, TrickEvent, TrickEventCard};
use App\Services\Tricks\{TrickGameService, TrickRecordService, TrickStageAllocator, TrickStateService};
use Carbon\CarbonImmutable;
use Database\Seeders\{TrickProduction261009Seeder, TrickReplenish261009Seeder};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
class TrickReplenish261009SeederTest extends TestCase
{
    use RefreshDatabase;
    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }
    private function fixture(): TrickEvent
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-10 12:00:00', 'Asia/Tokyo'));
        foreach (range(101, 499) as $id) DB::table('stages')->insert([
            'stage_id' => $id, 'stage_name' => 'Synthetic source', 'eng_stage_name' => 'Synthetic',
            'stage_sub' => '', 'type' => 'stage', 'display' => 'int', 'series' => intdiv($id, 100),
            'parent' => 0, 'time' => 0, 'treasure' => 0, 'pikmin' => 0,
            'border1' => 0, 'border2' => 0, 'border3' => 0, 'border4' => 0]);
        $this->seed(TrickProduction261009Seeder::class);
        $event = TrickEvent::where('event_id', 261009)->firstOrFail();
        foreach (['seed_alice', 'seed_bob', 'seed_carol'] as $name) Player::create([
            'event_id' => 261009, 'name' => $name, 'draw_points' => 50, 'rank_points' => 9,
            'card_count' => 0, 'take_count' => 0]);
        return $event;
    }
    private function snapshots(array $tables): array
    {
        $result = [];
        foreach ($tables as $table) $result[$table] = DB::table($table)->orderBy('id')->get()->toJson();
        return $result;
    }
    public function test_append_order_preserves_existing_status_and_retry_after_play(): void
    {
        $event = $this->fixture();
        $originals = Deck::where('eventId', 261009)->orderBy('id')->get();
        $cards = TrickEventCard::where('event_id', 261009)->orderBy('id')->get();
        foreach (['seed_alice', '_trash', '_collected', '_stack', '_field'] as $index => $state) {
            $cards[$index]->update(['state' => $state, 'rarity' => 4, 'draw_count' => 3,
                'paid_points_total' => 7, 'post_count' => 2, 'taker' => 'seed_alice']);
        }
        $beforeDecks = $originals->toArray();
        $beforeCards = $cards->map(fn ($card) => $card->fresh()->toArray())->all();
        $tables = ['trick_events', 'players', 'trick_card_payments', 'trick_card_holders', 'trick_collection_rewards', 'trick_event_records', 'limit_logs'];
        $beforeOther = $this->snapshots($tables);
        $this->seed(TrickReplenish261009Seeder::class);
        self::assertSame($beforeDecks, Deck::whereIn('id', $originals->pluck('id'))->orderBy('id')->get()->toArray());
        self::assertSame($beforeCards, TrickEventCard::whereIn('id', $cards->pluck('id'))->orderBy('id')->get()->toArray());
        self::assertSame($beforeOther, $this->snapshots($tables));
        $copies = Deck::whereNotNull('clone_source_deck_id')->orderBy('id')->get();
        self::assertCount(160, $copies);
        foreach ($copies as $index => $copy) {
            self::assertSame('261009-'.($index + 161), $copy->card_key);
            self::assertSame((int) $originals[$index]->id, (int) $copy->clone_source_deck_id);
            self::assertNull($copy->stage_id);
            self::assertSame($originals[$index]->text, $copy->text);
            $card = TrickEventCard::where('deck_id', $copy->id)->firstOrFail();
            self::assertSame('_deck', $card->state);
            self::assertNull($card->rarity);
            self::assertSame(0, (int) $card->draw_count);
            self::assertSame('261009-'.($index + 161), app(TrickStateService::class)->normalizeCard($card)['card_key']);
        }
        self::assertSame(320, $event->cards()->count());
        self::assertSame(315, $event->cards()->where('state', '_deck')->count());
        $game = app(TrickGameService::class);
        $copyCard = TrickEventCard::where('deck_id', $copies[0]->id)->firstOrFail();
        $copyCard->update(['state' => 'seed_bob']);
        $filler = TrickEventCard::where('deck_id', $copies[1]->id)->firstOrFail();
        $filler->update(['state' => 'seed_bob']);
        $game->take($event, 'seed_bob', $copies[0]->id);
        $deckState = Deck::orderBy('id')->get()->toArray();
        $cardState = TrickEventCard::orderBy('id')->get()->toArray();
        $this->seed(TrickReplenish261009Seeder::class);
        self::assertSame($deckState, Deck::orderBy('id')->get()->toArray());
        self::assertSame($cardState, TrickEventCard::orderBy('id')->get()->toArray());
    }
    public function test_1356_and_copy_keep_descending_order_and_other_401_time_stays_ascending(): void
    {
        $event = $this->fixture();
        $source = Deck::where('origin_stage_id', 401)->where('score_type', 'time')->firstOrFail();
        $source->update(['stage_id' => 1356]);
        app(TrickStageAllocator::class)->ensure($event, $source);
        $sourceCard = TrickEventCard::where('deck_id', $source->id)->firstOrFail();
        $sourceCard->update(['state' => '_field', 'taker' => 'seed_alice', 'rarity' => 1,
            'stack_count' => 2, 'taken_at' => CarbonImmutable::now(), 'limit_at' => CarbonImmutable::now()->addHour()]);
        $this->seed(TrickReplenish261009Seeder::class);
        $copy = Deck::where('clone_source_deck_id', $source->id)->firstOrFail();
        app(TrickStageAllocator::class)->ensure($event, $copy);
        $copyCard = TrickEventCard::where('deck_id', $copy->id)->firstOrFail();
        $copyCard->update(['state' => '_field', 'taker' => 'seed_alice', 'rarity' => 1,
            'stack_count' => 2, 'taken_at' => CarbonImmutable::now(), 'limit_at' => CarbonImmutable::now()->addHour()]);
        foreach ([$sourceCard, $copyCard] as $card) {
            self::assertSame(['score', 'DESC'], Func::orderByRule($card->fresh()->deck->stage_id, 1));
            foreach ([['seed_bob', 100], ['seed_carol', 400]] as [$user, $score]) {
                $record = Record::create(['user_id' => $user, 'score' => $score,
                    'stage_id' => $card->fresh()->deck->stage_id, 'rule' => 1, 'console' => 1,
                    'difficulty' => 1, 'region' => '1', 'team' => 0, 'unique_id' => random_int(100000000, 999999999),
                    'post_comment' => 'Synthetic different plays', 'user_ip' => '127.0.0.1', 'user_host' => 'localhost',
                    'user_agent' => 'phpunit', 'img_url' => '', 'video_url' => '', 'post_memo' => '', 'flg' => 0]);
                app(TrickRecordService::class)->saved($record);
            }
            self::assertSame([400, 100], array_column(app(TrickRecordService::class)->rankings($card), 'score'));
        }
        $ordinary = Deck::create(['eventId' => 990001, 'origin_stage_id' => 401, 'score_type' => 'time',
            'title' => 'Synthetic elapsed timer', 'rule_name' => 'Elapsed', 'text' => 'Synthetic', 'rewards' => 0]);
        app(TrickStageAllocator::class)->ensure($event, $ordinary);
        self::assertSame(['score', 'ASC'], Func::orderByRule($ordinary->stage_id, 1));
        self::assertSame(1356, (int) $source->fresh()->stage_id);
    }
    public function test_bad_original_content_aborts_without_inserting_cards(): void
    {
        $this->fixture();
        Deck::where('eventId', 261009)->orderBy('id')->first()->update(['title' => 'Changed identity']);
        try { $this->seed(TrickReplenish261009Seeder::class); self::fail('must abort'); }
        catch (\RuntimeException $e) { self::assertStringContainsString('CSV', $e->getMessage()); }
        self::assertSame(160, Deck::where('eventId', 261009)->count());
    }
    public function test_ended_event_and_stage_exhaustion_do_not_insert_cards(): void
    {
        $event = $this->fixture();
        $event->update(['state' => 'ended']);
        try { $this->seed(TrickReplenish261009Seeder::class); self::fail('must abort'); }
        catch (\RuntimeException $e) { self::assertStringContainsString('開催中', $e->getMessage()); }
        $event->update(['state' => 'active']);
        for ($id = 1001; $id <= 1849; $id++) DB::table('stages')->insert([
            'stage_id' => $id, 'stage_name' => 'Synthetic occupied', 'eng_stage_name' => 'Synthetic',
            'stage_sub' => '', 'type' => 'stage', 'display' => 'int', 'series' => 0,
            'parent' => 0, 'time' => 0, 'treasure' => 0, 'pikmin' => 0,
            'border1' => 0, 'border2' => 0, 'border3' => 0, 'border4' => 0]);
        try { $this->seed(TrickReplenish261009Seeder::class); self::fail('must abort'); }
        catch (\RuntimeException $e) { self::assertStringContainsString('160枠', $e->getMessage()); }
        self::assertSame(160, Deck::where('eventId', 261009)->count());
        self::assertSame(160, TrickEventCard::where('event_id', 261009)->count());
    }
    public function test_insert_conflict_rolls_back_every_new_card(): void
    {
        $this->fixture();
        Deck::create(['eventId' => 990001, 'origin_stage_id' => 401, 'title' => 'Synthetic collision',
            'rule_name' => 'Collision', 'text' => 'Synthetic', 'rewards' => 0, 'card_key' => '261009-170']);
        try { $this->seed(TrickReplenish261009Seeder::class); self::fail('must abort'); }
        catch (\Illuminate\Database\QueryException $e) { self::assertTrue(true); }
        self::assertSame(160, Deck::where('eventId', 261009)->count());
        self::assertSame(160, TrickEventCard::where('event_id', 261009)->count());
        self::assertSame(0, Deck::where('eventId', 261009)->whereNotNull('clone_source_deck_id')->count());
    }
    public function test_copy_draw_is_first_opening_and_partial_retry_is_rejected(): void
    {
        $event = $this->fixture();
        $this->seed(TrickReplenish261009Seeder::class);
        $copy = Deck::where('card_key', '261009-161')->firstOrFail();
        TrickEventCard::where('event_id', 261009)->where('deck_id', '!=', $copy->id)->update(['state' => '_excluded']);
        $draw = app(TrickGameService::class)->draw($event, 'seed_bob');
        self::assertSame('261009-161', $draw['card']['card_key']);
        self::assertSame(1, (int) TrickEventCard::where('deck_id', $copy->id)->value('draw_count'));
        self::assertGreaterThanOrEqual(1, (int) $draw['card']['rarity']);
        self::assertSame(49, Player::where('name', 'seed_bob')->value('draw_points'));
        TrickEventCard::where('deck_id', $copy->id)->delete();
        $before = Deck::orderBy('id')->get()->toArray();
        try { $this->seed(TrickReplenish261009Seeder::class); self::fail('must abort'); }
        catch (\RuntimeException $e) { self::assertStringContainsString('登録が不足', $e->getMessage()); }
        self::assertSame($before, Deck::orderBy('id')->get()->toArray());
    }

    public function test_live_rule_and_difficulty_corrections_are_copied_without_reverting_originals(): void
    {
        $this->fixture();
        $source = Deck::where('eventId', 261009)->orderBy('id')->firstOrFail();
        $source->update(['text' => 'Live corrected synthetic rule', 'difficulty' => 4]);
        $before = $source->fresh()->toArray();
        $this->seed(TrickReplenish261009Seeder::class);
        $copy = Deck::where('clone_source_deck_id', $source->id)->firstOrFail();
        self::assertSame('Live corrected synthetic rule', $copy->text);
        self::assertSame(4, (int) $copy->difficulty);
        self::assertSame(4, (int) TrickEventCard::where('deck_id', $copy->id)->value('difficulty'));
        self::assertSame($before, $source->fresh()->toArray());
    }

}
