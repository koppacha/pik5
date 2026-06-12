<?php

namespace Tests;

use Illuminate\Contracts\Console\Kernel;

trait CreatesApplication
{
    /**
     * Creates the application.
     *
     * @return \Illuminate\Foundation\Application
     */
    public function createApplication()
    {
        $app = require __DIR__.'/../bootstrap/app.php';

        $app->make(Kernel::class)->bootstrap();

        $config = $app->make('config');
        $sqlite = $config->get('database.connections.sqlite');
        $sqlite['database'] = ':memory:';
        $config->set('database.default', 'sqlite');
        $config->set('database.connections.sqlite', $sqlite);
        $config->set('database.connections.mysql', $sqlite);
        $app->make('db')->purge();
        $app->make('db')->setDefaultConnection('sqlite');

        return $app;
    }
}
