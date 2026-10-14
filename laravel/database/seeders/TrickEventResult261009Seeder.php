<?php

namespace Database\Seeders;

use App\Services\TrickEventResultService;
use Illuminate\Database\Seeder;

class TrickEventResult261009Seeder extends Seeder
{
    public function run(TrickEventResultService $service): void
    {
        $data = $service->import();
        $this->command?->info(count($data['rows']) . ' tournament results imported.');
    }
}
