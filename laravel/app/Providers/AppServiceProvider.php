<?php

namespace App\Providers;

use Illuminate\Console\Events\CommandStarting;
use Illuminate\Support\ServiceProvider;
use RuntimeException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        if (class_exists(\Laravel\Telescope\TelescopeApplicationServiceProvider::class)) {
            $this->app->register(TelescopeServiceProvider::class);
        }
    }

    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        if (! $this->app->runningInConsole()) {
            return;
        }

        $this->app['events']->listen(CommandStarting::class, function (CommandStarting $event) {
            if (! config('database.protect_destructive_commands')) {
                return;
            }

            if (in_array($event->command, config('database.destructive_commands'), true)) {
                throw new RuntimeException(
                    "The [{$event->command}] command is disabled by database protection."
                );
            }
        });
    }
}
