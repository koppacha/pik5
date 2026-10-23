<?php

namespace Tests\Feature;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DandoriMonthlyTest extends TestCase
{
    use RefreshDatabase;

    public function test_october_fixture_is_shown_and_future_months_are_hidden_even_with_past_publish_dates(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-16T00:00:00+09:00'));
        $this->release('2026-10', 445, '2026-10-01 00:00:00');
        $this->release('2026-11', 451, '2026-10-01 00:00:00');
        $this->getJson('/api/dandori')->assertOk()->assertJsonPath('month', '2026-10')
            ->assertJsonPath('monthly.0.stage_code', '445')->assertJsonPath('monthly.5.stage_code', '450')
            ->assertJsonCount(6, 'monthly')->assertJsonCount(6, 'stages');
        $this->getJson('/api/stage/451')->assertNotFound();
    }

    public function test_previous_month_remains_until_current_release_is_published_at_japan_boundary(): void
    {
        $this->release('2026-11', 445, '2026-11-11 15:00:00');
        $this->release('2026-12', 451, '2026-12-11 15:00:00');
        $this->travelTo(CarbonImmutable::parse('2026-12-11T14:59:59Z'));
        $this->getJson('/api/dandori')->assertJsonPath('month', '2026-11')->assertJsonPath('monthly.0.stage_code', '445');
        $this->travelTo(CarbonImmutable::parse('2026-12-11T15:00:00Z'));
        $this->getJson('/api/dandori')->assertJsonPath('month', '2026-12')->assertJsonPath('monthly.0.stage_code', '451');
    }

    public function test_missing_draft_and_incomplete_current_release_fall_back_only_to_previous_month(): void
    {
        $this->release('2026-11', 445, '2026-11-11 15:00:00');
        $this->travelTo(CarbonImmutable::parse('2026-12-16T00:00:00+09:00'));
        $this->getJson('/api/dandori')->assertJsonPath('month', '2026-11');
        $id = $this->release('2026-12', 451, null);
        $this->getJson('/api/dandori')->assertJsonPath('month', '2026-11');
        DB::table('dandori_releases')->where('id', $id)->update(['publish_at' => '2026-12-11 15:00:00']);
        DB::table('dandori_slots')->where('release_id', $id)->where('position', 6)->delete();
        $this->getJson('/api/dandori')->assertJsonPath('month', '2026-11')->assertJsonCount(6, 'monthly');
        $this->travelTo(CarbonImmutable::parse('2027-02-01T00:00:00+09:00'));
        $this->getJson('/api/dandori')->assertJsonPath('month', null)->assertJsonCount(0, 'monthly');
    }

    public function test_repeats_all_twelve_original_months_on_the_first_in_japan_without_new_membership(): void
    {
        $origin = CarbonImmutable::parse('2026-11-01T00:00:00+09:00');
        foreach (range(0, 11) as $offset) {
            $month = $origin->addMonths($offset);
            $this->release($month->format('Y-m'), 445 + $offset * 6, $month->day(12)->utc()->format('Y-m-d H:i:s'));
        }
        // One second before the recurring period, October still shows its original batch.
        $this->travelTo(CarbonImmutable::parse('2027-10-31T14:59:59Z'));
        $this->getJson('/api/dandori')->assertJsonPath('month', '2027-10')->assertJsonPath('monthly.0.stage_code', '511');
        foreach (range(0, 24) as $offset) {
            $display = $origin->addMonths(12 + $offset);
            $source = $origin->addMonths($offset % 12);
            $this->travelTo($display);
            $this->getJson('/api/dandori')->assertOk()->assertJsonPath('month', $display->format('Y-m'))
                ->assertJsonPath('source_month', $source->format('Y-m'))
                ->assertJsonPath('monthly.0.stage_code', (string) (445 + ($offset % 12) * 6))->assertJsonCount(6, 'monthly');
        }
        $this->assertDatabaseCount('dandori_releases', 12);
        $this->assertDatabaseCount('dandori_slots', 72);
    }

    private function release(string $month, int $firstId, ?string $publishAt): int
    {
        $id = DB::table('dandori_releases')->insertGetId(['month' => $month, 'revision' => 1, 'publish_at' => $publishAt]);
        foreach (range(0, 5) as $index) {
            $stageId = $firstId + $index;
            DB::table('stages')->insert([
                'stage_id' => $stageId, 'stage_code' => (string) $stageId,
                'stage_name' => 'Synthetic '.$stageId, 'eng_stage_name' => 'Synthetic '.$stageId, 'stage_sub' => '',
                'series' => 4, 'parent' => 48, 'type' => 'stage', 'display' => 'time', 'difficulty' => $index % 3 + 1,
                'time' => 300, 'treasure' => 0, 'pikmin' => 0, 'border1' => 0, 'border2' => 0, 'border3' => 0, 'border4' => 0,
            ]);
            DB::table('dandori_stages')->insert([
                'stage_id' => $stageId, 'score_type' => 'time', 'score_order' => 'DESC', 'total_base' => 300, 'consoles' => '[4]',
            ]);
            DB::table('dandori_slots')->insert(['release_id' => $id, 'position' => $index + 1, 'stage_id' => $stageId]);
        }
        return $id;
    }
}
