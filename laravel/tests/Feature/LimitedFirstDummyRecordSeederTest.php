<?php

namespace Tests\Feature;

use App\Http\Controllers\EventResultController;
use App\Models\EventResult;
use App\Services\EventStampService;
use Database\Seeders\LimitedFirstDummyRecordSeeder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;
use Tests\TestCase;

class LimitedFirstDummyRecordSeederTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', DB::connection()->getDriverName());
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        (require database_path('migrations/2023_01_05_164529_create_record_table.php'))->up();
        Schema::table('records', static fn (Blueprint $t) => $t->integer('team')->default(0));
        (require database_path('migrations/2026_05_24_000001_create_event_results_table.php'))->up();
        Schema::create('stages', static function (Blueprint $t) {
            $t->integer('stage_id')->primary();
            $t->integer('parent');
            $t->integer('series');
            $t->string('holder')->nullable();
            $t->timestamps();
        });
        DB::table('stages')->insert([
            ['stage_id' => 1001, 'parent' => 151101, 'series' => 2, 'holder' => null],
            ['stage_id' => 1003, 'parent' => 160306, 'series' => 2, 'holder' => 'test-holder'],
        ]);
    }

    public function test_seed_is_idempotent_and_first_event_appears_without_changing_later_events(): void
    {
        EventResult::create(['event_id' => 160306, 'user_id' => 'test-other', 'category' => '期間限定ランキング', 'rps' => 42]);
        $later = EventResult::first()->toArray();
        $this->seed(LimitedFirstDummyRecordSeeder::class);
        $before = EventResult::orderBy('id')->get()->toArray();
        $this->seed(LimitedFirstDummyRecordSeeder::class);
        $this->assertSame($before, EventResult::orderBy('id')->get()->toArray());
        $this->assertSame($later, EventResult::where('event_id', 160306)->first()->toArray());
        $this->assertSame('test-holder', DB::table('stages')->where('stage_id', 1003)->value('holder'));
        $this->assertSame(1, DB::table('records')->count());
        $record = DB::table('records')->first();
        $this->assertSame('koppacha', $record->user_id);
        $this->assertSame(4700, (int) $record->score);
        $this->assertSame(1001, (int) $record->stage_id);
        $this->assertGreaterThanOrEqual('2015-11-01 15:00:00', $record->created_at);
        $this->assertLessThanOrEqual('2015-11-08 14:59:59', $record->created_at);

        $data = app(EventResultController::class)->show(Request::create('/api/event-total/151'), app(EventStampService::class), '151')->getData(true);
        $this->assertContains(151101, array_column($data['events'], 'event_id'));
        $user = collect($data['posts'])->firstWhere('user_id', 'koppacha');
        $marker = collect($user['events'])->firstWhere('event_id', 151101);
        $this->assertNotNull($marker);
        $this->assertSame(0, $marker['stamp']);
        $this->assertSame('w', $marker['result']);
        $this->assertSame(0, $user['stamp']);
        $first = EventResult::where('event_id', 151101)->first();
        $this->assertSame(4700, (int) $first->score);
        $this->assertSame(1, (int) $first->rps);
        $this->assertSame(2, (int) $first->rps_adjust);
        $this->assertSame('w', $first->result);
    }

    public function test_seed_refuses_existing_results_without_partial_writes(): void
    {
        EventResult::create(['event_id' => 151101, 'user_id' => 'test-existing', 'score' => 123]);
        try {
            $this->seed(LimitedFirstDummyRecordSeeder::class);
            $this->fail('Expected existing data to be protected.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('Existing first-event data', $e->getMessage());
        }
        $this->assertSame(0, DB::table('records')->count());
        $this->assertSame(123, (int) EventResult::first()->score);
    }

    public function test_seed_refuses_modified_dummy_record_without_overwriting_it(): void
    {
        $this->seed(LimitedFirstDummyRecordSeeder::class);
        DB::table('records')->update(['score' => 4800]);
        try {
            $this->seed(LimitedFirstDummyRecordSeeder::class);
            $this->fail('Expected modified data to be protected.');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('conflicts', $e->getMessage());
        }
        $this->assertSame(4800, (int) DB::table('records')->value('score'));
    }
}
