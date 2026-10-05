<?php

namespace Tests\Feature;

use App\Http\Controllers\EventResultController;
use App\Models\EventResult;
use App\Services\EventStampService;
use Database\Seeders\EventResultCsvSeeder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class EventResultCsvSeederTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', DB::connection()->getDriverName());
        $this->assertSame(':memory:', DB::connection()->getDatabaseName());
        $migration = require database_path('migrations/2026_05_24_000001_create_event_results_table.php');
        $migration->up();
    }

    public function test_latest_results_are_ranked_and_unrelated_results_survive_reseeding(): void
    {
        EventResult::create(['id' => 999999, 'event_id' => 991231, 'category' => 'その他', 'user_id' => 'test-only', 'score' => 42]);
        $this->seed(EventResultCsvSeeder::class);
        $this->seed(EventResultCsvSeeder::class);

        $this->assertSame(295, EventResult::count());
        $this->assertSame(42, (int)EventResult::findOrFail(999999)->score);
        $this->assertSame('yukimidaifuku', EventResult::findOrFail(284)->user_id);
        $this->assertSame('Mutou_p2pw', EventResult::findOrFail(289)->user_id);
        $this->assertSame('Rinkuru0912', EventResult::findOrFail(294)->user_id);
        $this->assertSame(10, EventResult::where('event_id', 261003)->count());
        $this->assertSame(0, EventResult::whereIn('user_id', ['NitrosB', 'chalumeau', 'mutou_p2pw'])->count());

        $result = app(EventResultController::class)->show(Request::create('/api/event-total/261'), app(EventStampService::class), '261')->getData(true);
        $this->assertCount(12, $result['events']);
        $this->assertSame('2026-10-03 00:00:00', $result['last_updated_at']);
        $this->assertSame(['nitrosmish', 'albut3', 'koppacha'], array_column(array_slice($result['posts'], 0, 3), 'user_id'));
        $this->assertSame([4810, 4770, 3989], array_column(array_slice($result['posts'], 0, 3), 'score'));
    }

    public function test_third_instant_event_is_retained_but_excluded_until_explicitly_restored(): void
    {
        $this->seed(EventResultCsvSeeder::class);
        $this->assertSame(8, EventResult::where('category', 'インスタント研究会')->where('event_id', 260221)->count());
        // A future seed must not automatically remove the temporary exclusion.
        EventResult::create(['id' => 999998, 'event_id' => 261010, 'event_title' => '将来のインスタント研究会', 'category' => 'インスタント研究会', 'user_id' => 'test-only', 'team' => 0, 'score' => 100, 'rps' => 0, 'rps_adjust' => 0, 'result' => 'w']);
        EventResult::create(['id' => 999997, 'event_id' => 260221, 'category' => 'その他', 'user_id' => 'other-category-test', 'team' => 0, 'score' => 42, 'rps' => 0, 'rps_adjust' => 0, 'result' => 'w']);
        $this->seed(EventResultCsvSeeder::class);
        foreach (['261', '200', '0'] as $category) {
            $result = app(EventResultController::class)->show(Request::create('/api/event-total/' . $category), app(EventStampService::class), $category)->getData(true);
            foreach ($result['posts'] as $post) {
                foreach ($post['events'] as $event) {
                    $this->assertFalse($event['category'] === 'インスタント研究会' && $event['event_id'] === 260221);
                }
            }
            $this->assertContains(261010, array_column($result['events'], 'event_id'));
            if ($category !== '261') {
                $this->assertContains('other-category-test', array_column($result['posts'], 'user_id'));
            }
        }
        $this->assertSame(8, EventResult::where('category', 'インスタント研究会')->where('event_id', 260221)->count());
    }

    public function test_conflicting_ids_abort_without_changing_existing_results(): void
    {
        EventResult::create(['id' => 1, 'event_id' => 991231, 'category' => 'その他', 'user_id' => 'test-only', 'score' => 42]);
        try {
            $this->seed(EventResultCsvSeeder::class);
            $this->fail('Expected conflicting CSV ID to abort.');
        } catch (RuntimeException $exception) {
            $this->assertSame('CSV ID conflicts with an existing event result.', $exception->getMessage());
        }
        $this->assertSame(1, EventResult::count());
        $this->assertSame(42, (int)EventResult::findOrFail(1)->score);
    }
}
