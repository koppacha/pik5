<?php

namespace App\Console\Commands;

use App\Services\TotalSnapshotService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class FetchUserTotals extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'user:fetch-totals
        {--year= : 対象年}
        {--month= : 対象月}
        {--months=1 : 指定月から過去何ヶ月分を作成するか}
        {--latest : 月次履歴ではなく最新のtotalsを更新する}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Fetch totals for all users and update totals or monthly snapshots.';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle(): int
    {
        $service = new TotalSnapshotService();

        if ($this->option('latest')) {
            $result = $service->updateLatestTotals();
            $this->info("Updated latest totals. rows: {$result['rows']}");
            return 0;
        }

        $months = max(1, (int)$this->option('months'));
        $year = $this->option('year');
        $month = $this->option('month');
        if (!$year && (int)$month > 12) {
            $months = (int)$month;
            $month = null;
        }
        $target = ($year && $month)
            ? Carbon::create((int)$year, (int)$month, 1)
            : Carbon::now()->subMonthNoOverflow()->startOfMonth();

        for ($i = 0; $i < $months; $i++) {
            $current = (clone $target)->subMonthsNoOverflow($i);
            try {
                $result = $service->storeMonth((int)$current->format('Y'), (int)$current->format('n'));
                $this->info("Created {$result['year']}/{$result['month']} snapshot. rows: {$result['rows']}");
            } catch (\InvalidArgumentException $e) {
                $this->error($e->getMessage());
                return 1;
            }
        }

        $this->info('All snapshots processed successfully.');
        return 0;
    }
}
