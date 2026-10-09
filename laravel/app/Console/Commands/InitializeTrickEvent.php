<?php

namespace App\Console\Commands;

use App\Models\TrickEvent;
use App\Services\Tricks\TrickEventInitializer;
use Illuminate\Console\Command;

class InitializeTrickEvent extends Command
{
    protected $signature = 'tricks:initialize-event {event_id} {--dry-run}';

    protected $description = 'トリックテイキング制の大会山札を160枚で初期化する';

    public function handle(TrickEventInitializer $initializer): int
    {
        $event = TrickEvent::query()->where('event_id', (int) $this->argument('event_id'))->first();
        if ($event === null) {
            $this->error('指定された大会がありません');

            return self::FAILURE;
        }

        $result = $this->option('dry-run')
            ? $initializer->inspect($event)
            : $initializer->initialize($event);
        $this->table(['項目', '値'], collect($result)->map(fn ($value, $key) => [$key, json_encode($value)])->values());

        return self::SUCCESS;
    }
}
