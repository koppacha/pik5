<?php

// Run only against the disposable test container (no published ports or persistent volume).
require '/var/www/laravel/vendor/autoload.php';
$app = require '/var/www/laravel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (getenv('PIK5_TRICKS_ALLOCATION_TEST_HOST') !== 'pik5-release-mysql-test') {
    throw new RuntimeException('Dedicated temporary MySQL container is required');
}
config(['database.default' => 'release_audit', 'database.connections.release_audit' => [
    'driver' => 'mysql', 'host' => 'pik5-release-mysql-test', 'port' => 3306,
    'database' => 'tricks_release_test', 'username' => 'root', 'password' => '',
    'charset' => 'utf8mb4', 'collation' => 'utf8mb4_unicode_ci', 'prefix' => '', 'strict' => true,
]]);
use App\Models\{Deck, TrickEvent};
use App\Services\Tricks\TrickStageAllocator;
use Illuminate\Support\Facades\DB;

$mode = $argv[1] ?? 'parent';
if ($mode !== 'parent') {
    $deck = Deck::findOrFail((int) $argv[2]);
    $event = TrickEvent::where('event_id', $deck->event_id)->firstOrFail();
    $id = DB::transaction(function () use ($mode, $deck, $event): int {
        if ($mode === 'R') {
            app(TrickStageAllocator::class)->lock();
            app(App\Services\Tricks\TrickRulingService::class)->apply($event, $deck->id, 'audit_admin', ['idempotency_key' => 'concurrent-rule-test', 'title' => 'Concurrent updated'], false, Illuminate\Http\Request::create('/synthetic-rule', 'POST'));
            file_put_contents($GLOBALS['argv'][3], 'ready');
            usleep(1500000);
            return $deck->stage_id;
        }
        if ($mode === 'T') {
            return app(App\Services\Tricks\TrickGameService::class)->take($event, 'concurrent_a', $deck->id)['card']['stage_id'];
        }
        // B takes a REPEATABLE READ snapshot before A commits.
        if ($mode === 'B') DB::table('stages')->count();
        $id = app(TrickStageAllocator::class)->ensure($event, $deck);
        if ($mode === 'A') {
            file_put_contents($GLOBALS['argv'][3], 'ready');
            usleep(1500000);
        }
        return $id;
    });
    echo json_encode(['worker' => $mode, 'stage_id' => $id]).PHP_EOL;
    exit;
}

if (Deck::whereBetween('event_id', [990415, 990416])->exists()) {
    throw new RuntimeException('Use a newly migrated empty temporary database');
}
$decks = [];
foreach ([990415, 990416] as $eventId) {
    TrickEvent::firstOrCreate(['event_id' => $eventId], ['title' => 'Allocation concurrency test', 'start_at' => now()->subHour(), 'end_at' => now()->addHours(47), 'state' => 'active', 'test_mode' => true]);
    $decks[] = Deck::create(['event_id' => $eventId, 'eventId' => $eventId, 'card_id' => $eventId, 'title' => 'Synthetic allocator', 'text' => 'Synthetic', 'rule_name' => 'Test', 'difficulty' => 1, 'state' => '_in_event', 'rewards' => 0, 'score_type' => 'time']);
}
$ready = tempnam(sys_get_temp_dir(), 'tricks-allocator-');
unlink($ready);
$start = function (string $mode, int $id) use ($ready): array {
    $process = proc_open([PHP_BINARY, __FILE__, $mode, (string) $id, $ready], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    return [$process, $pipes];
};
[$a, $ap] = $start('A', $decks[0]->id);
$until = microtime(true) + 10;
while (! file_exists($ready) && microtime(true) < $until) usleep(10000);
if (! file_exists($ready)) throw new RuntimeException('A did not acquire allocation lock');
[$b, $bp] = $start('B', $decks[1]->id);
$results = [];
foreach ([[$a, $ap], [$b, $bp]] as [$process, $pipes]) {
    $out = stream_get_contents($pipes[1]);
    $error = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    if (proc_close($process) !== 0) throw new RuntimeException($error);
    $results[] = json_decode($out, true, 512, JSON_THROW_ON_ERROR);
}
unlink($ready);
if ($results[0]['stage_id'] === $results[1]['stage_id']) throw new RuntimeException('Duplicate allocation');
foreach ($results as $result) {
    if (DB::table('stages')->where('stage_id', $result['stage_id'])->value('display') !== 'time') throw new RuntimeException('Time metadata lost');
}
echo 'PASS isolated MySQL concurrent outer transactions: '.json_encode($results).PHP_EOL;

// Exercise the actual rule mutation and take services against different events.
foreach ([990415, 990416] as $eventId) {
    TrickEvent::where('event_id', $eventId)->update(['initialized_at' => now(), 'debug' => true, 'debug_now' => now()]);
}
App\Models\Player::create(['event_id' => 990415, 'name' => 'concurrent_a', 'draw_points' => 20, 'card_count' => 3]);
App\Models\Player::create(['event_id' => 990416, 'name' => 'concurrent_b', 'draw_points' => 20]);
App\Models\TrickEventCard::create(['event_id' => 990416, 'deck_id' => $decks[1]->id, 'state' => '_field', 'taker' => 'concurrent_b', 'limit_at' => now()->addHour(), 'rarity' => 1, 'difficulty' => 1, 'stack_count' => 3]);
$hand = [];
foreach ([1, 2, 3] as $i) {
    $deck = $decks[0]->replicate();
    $deck->card_id = 990420 + $i;
    $deck->stage_id = null;
    $deck->save();
    App\Models\TrickEventCard::create(['event_id' => 990415, 'deck_id' => $deck->id, 'state' => 'concurrent_a', 'rarity' => 1, 'difficulty' => 1]);
    $hand[] = $deck;
}
[$r, $rp] = $start('R', $decks[1]->id);
$until = microtime(true) + 10;
while (! file_exists($ready) && microtime(true) < $until) usleep(10000);
if (! file_exists($ready)) throw new RuntimeException('Ruling did not acquire allocation lock');
[$t, $tp] = $start('T', $hand[0]->id);
$results = [];
foreach ([[$r, $rp], [$t, $tp]] as [$process, $pipes]) {
    $out = stream_get_contents($pipes[1]);
    $error = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    if (proc_close($process) !== 0) throw new RuntimeException($error);
    $results[] = json_decode($out, true, 512, JSON_THROW_ON_ERROR);
}
unlink($ready);
if ($results[0]['stage_id'] === $results[1]['stage_id']) throw new RuntimeException('Rule/take allocation collision');
echo 'PASS isolated MySQL concurrent ruling and take: '.json_encode($results).PHP_EOL;
foreach (['_DECK', '_deck ', '_déck', '＿deck'] as $alias) {
    $same = DB::selectOne('SELECT CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci = CAST(? AS CHAR CHARACTER SET utf8mb4) COLLATE utf8mb4_unicode_ci AS same', [$alias, '_deck'])->same;
    if ($same && App\Services\Tricks\TrickRequestIdentity::isSafeUserId($alias)) throw new RuntimeException('Collation alias accepted');
}
echo 'PASS MySQL collation aliases rejected'.PHP_EOL;
