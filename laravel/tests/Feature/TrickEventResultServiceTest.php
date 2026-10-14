<?php

namespace Tests\Feature;

use App\Models\EventResult;
use App\Services\TrickEventResultService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class TrickEventResultServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', DB::connection()->getDriverName());
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        (require database_path('migrations/2026_05_24_000001_create_event_results_table.php'))->up();
        Schema::create('trick_events', static function (Blueprint $t) {
            $t->integer('event_id'); $t->dateTime('end_at'); $t->dateTime('ended_at')->nullable();
        });
        Schema::create('players', static function (Blueprint $t) {
            $t->integer('event_id'); $t->string('name'); $t->integer('rank_points');
        });
        Schema::create('trick_event_cards', static function (Blueprint $t) {
            $t->integer('id'); $t->integer('event_id'); $t->string('state'); $t->dateTime('collected_at')->nullable();
        });
        Schema::create('limit_logs', static function (Blueprint $t) {
            $t->integer('event_id'); $t->string('event'); $t->integer('event_card_id'); $t->text('context');
        });
        DB::table('trick_events')->insert(['event_id' => 261009, 'end_at' => '2026-10-11 19:59:00', 'ended_at' => '2026-10-11 19:59:00']);
    }

    public function test_it_imports_separate_awards_idempotently_and_preserves_other_results(): void
    {
        $this->fixture([
            [['user_id' => 'alice', 'rank' => 1, 'rps' => 10], ['user_id' => 'bob', 'rank' => 2, 'rps' => 3]],
            [['user_id' => 'bob', 'rank' => 1, 'rps' => 3]],
            [['user_id' => 'bob', 'rank' => 1, 'rps' => 3], ['user_id' => 'carol', 'rank' => 2, 'rps' => 1]],
        ]);
        EventResult::create(['event_id' => 221008, 'category' => '期間限定ランキング', 'user_id' => 'historical', 'rps' => 42]);
        EventResult::create(['event_id' => 261009, 'category' => 'その他', 'user_id' => 'other', 'rps' => 17]);
        $service = app(TrickEventResultService::class);
        $dry = $service->import(false);
        $this->assertSame(2, EventResult::count());
        $this->assertSame(['alice' => 1, 'bob' => 2, 'carol' => 0], $dry['first_place_cards']);
        $service->import();
        $before = EventResult::orderBy('id')->get()->toArray();
        $service->import();
        $this->assertSame($before, EventResult::orderBy('id')->get()->toArray());
        $rows = EventResult::where('category', '期間限定ランキング')->where('event_id', 261009)->get()->keyBy('user_id');
        $this->assertSame('m', $rows['alice']->result);
        $this->assertSame('h', $rows['bob']->result);
        $this->assertSame('p', $rows['carol']->result);
        $this->assertSame(10, (int) $rows['alice']->rps);
        $this->assertSame(10, (int) $rows['alice']->rps_adjust);
        $this->assertSame(5, EventResult::count());
    }

    public function test_cofirst_places_and_tied_award_leaders_receive_both_awards(): void
    {
        $this->fixture([[['user_id' => 'alice', 'rank' => 1, 'rps' => 4], ['user_id' => 'bob', 'rank' => 1, 'rps' => 4]]]);
        $data = app(TrickEventResultService::class)->import();
        $this->assertSame(['alice' => 1, 'bob' => 1], $data['first_place_cards']);
        $this->assertSame(['b', 'b'], array_column($data['rows'], 'result'));
    }

    public function test_mismatched_frozen_points_abort_without_saving(): void
    {
        $this->fixture([[['user_id' => 'alice', 'rank' => 1, 'rps' => 4]]]);
        DB::table('players')->update(['rank_points' => 5]);
        try {
            app(TrickEventResultService::class)->import();
            $this->fail('Expected a point mismatch.');
        } catch (RuntimeException $e) {
            $this->assertSame('Frozen rank points do not match participant totals.', $e->getMessage());
        }
        $this->assertSame(0, EventResult::count());
    }

    public function test_missing_snapshot_aborts_without_saving(): void
    {
        $this->fixture([[['user_id' => 'alice', 'rank' => 1, 'rps' => 4]]]);
        DB::table('limit_logs')->delete();
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Collection snapshots are missing or duplicated.');
        app(TrickEventResultService::class)->import();
    }

    public function test_unfinished_tournament_is_not_imported(): void
    {
        DB::table('trick_events')->update(['ended_at' => null]);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('The tournament must be finalized');
        app(TrickEventResultService::class)->import();
    }

    private function fixture(array $cards): void
    {
        $points = [];
        foreach ($cards as $i => $ranks) {
            $id = $i + 1;
            DB::table('trick_event_cards')->insert(['id' => $id, 'event_id' => 261009, 'state' => '_collected', 'collected_at' => '2026-10-11 19:59:00']);
            DB::table('limit_logs')->insert(['event_id' => 261009, 'event_card_id' => $id, 'event' => 'collect', 'context' => json_encode(['rankings' => $ranks])]);
            foreach ($ranks as $r) {
                $points[$r['user_id']] = ($points[$r['user_id']] ?? 0) + $r['rps'];
            }
        }
        foreach ($points as $name => $total) {
            DB::table('players')->insert(['event_id' => 261009, 'name' => $name, 'rank_points' => $total]);
        }
    }
}
