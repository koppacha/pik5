<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     *
     * @param  \Illuminate\Console\Scheduling\Schedule  $schedule
     * @return void
     */
    protected function schedule(Schedule $schedule)
    {
        $schedule->command('user:fetch-totals')
            ->monthlyOn(1, '00:10')
            ->withoutOverlapping();

        $schedule->command('user:fetch-totals --latest')
            ->dailyAt('00:30')
            ->withoutOverlapping();

        if (config('database.backup.enabled')) {
            $schedule->command('db:backup')
                ->dailyAt(config('database.backup.time'))
                ->withoutOverlapping();
        }
    }

    /**
     * Register the commands for the application.
     *
     * @return void
     */
    protected function commands()
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
