<?php

namespace App\Console\Commands;

use App\Services\Tricks\TrickTestFixtureService;
use DomainException;
use Illuminate\Console\Command;

class ManageTrickTestFixture extends Command
{
    protected $signature = 'tricks:test-fixture
        {event_id : 900000〜999999のテスト用大会ID}
        {--players=playwright-a,playwright-b : カンマ区切りの参加者}
        {--seed= : 乱数seed}
        {--teardown : 対象fixtureを削除する}
        {--dry-run : 書き込まず予定件数を表示する}';

    protected $description = 'Playwright用の隔離されたトリック大会fixtureを作成または削除します';

    public function handle(TrickTestFixtureService $fixtures): int
    {
        $eventId = (int) $this->argument('event_id');
        $players = collect(explode(',', (string) $this->option('players')))
            ->map(fn (string $name) => trim($name))->filter()->values()->all();

        try {
            if ($this->option('dry-run')) {
                $result = $fixtures->inspect($eventId, $players);
            } elseif ($this->option('teardown')) {
                $result = $fixtures->teardown($eventId);
            } else {
                $result = $fixtures->create($eventId, [
                    'players' => $players,
                    'random_seed' => $this->option('seed'),
                ]);
            }
        } catch (DomainException $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        $this->line(json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        return self::SUCCESS;
    }
}
