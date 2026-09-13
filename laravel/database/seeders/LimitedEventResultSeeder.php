<?php

namespace Database\Seeders;

use App\Services\LimitedEventResultService;
use Illuminate\Database\Seeder;

class LimitedEventResultSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run(LimitedEventResultService $service): void
    {
        $service->recalculatePastLimitedResults();
    }
}
