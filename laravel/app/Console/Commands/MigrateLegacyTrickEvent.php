<?php

namespace App\Console\Commands;

use App\Models\TrickEvent;
use App\Services\Tricks\TrickLegacyMigrationService;
use Illuminate\Console\Command;

class MigrateLegacyTrickEvent extends Command
{
    protected $signature = 'tricks:migrate-legacy-event {event_id} {--dry-run : 件数だけ確認する}';

    protected $description = '旧トリック大会データを大会カード・投稿・支払・ホルダー履歴へ移行します';

    public function handle(TrickLegacyMigrationService $migration): int
    {
        $event = TrickEvent::query()->where('event_id', (int) $this->argument('event_id'))->first();
        if ($event === null) {
            $this->error('先にtrick_eventsへ対象大会を作成してください');

            return self::FAILURE;
        }
        $result = $this->option('dry-run') ? $migration->inspect($event) : $migration->migrate($event);
        $this->line(json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        return self::SUCCESS;
    }
}
