<?php

namespace App\Console\Commands;

use App\Services\LimitedEventResultService;
use Illuminate\Console\Command;

class RecalculateLimitedEventResults extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'event-results:recalculate-limited {--dry-run : Calculate without writing to the database}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Recalculate limited event results from records.';

    public function handle(LimitedEventResultService $service): int
    {
        $summary = $service->recalculatePastLimitedResults(!$this->option('dry-run'));

        $this->info(sprintf(
            'events=%d results=%d holders=%d%s',
            $summary['events'],
            $summary['results'],
            $summary['holders'],
            $this->option('dry-run') ? ' dry-run' : ''
        ));

        return self::SUCCESS;
    }
}
