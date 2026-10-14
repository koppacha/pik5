<?php
defined('STDOUT') || define('STDOUT', fopen('php://stdout', 'w'));
defined('STDERR') || define('STDERR', fopen('php://stderr', 'w'));
require '/var/www/laravel/vendor/autoload.php';
$app = require '/var/www/laravel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (class_exists(Laravel\Telescope\Telescope::class)) Laravel\Telescope\Telescope::stopRecording();
$app['config']->set('debugbar.enabled', false);
if ($app->bound('debugbar')) $app->make('debugbar')->disable();
$app['events']->forget(Illuminate\Database\Events\QueryExecuted::class);
$service = app(App\Services\Tricks\TrickReplayService::class);
$index = $service->index(261009);
$directory = storage_path('app/tricks/replay/261009');
$manifest = json_decode(file_get_contents($directory.'/manifest.json'), true);
$initial = json_decode(gzdecode(file_get_contents($directory.'/'.$manifest['checkpoints'][0]['file'])), true);
$patches = json_decode(gzdecode(file_get_contents($directory.'/frames.json.gz')), true);
$expectedRewards = [0 => $initial['rewards']];
$expectedPots = [0 => $initial['pot_points']];
foreach ($patches as $cursor => $patch) {
    $expectedRewards[$cursor + 1] = array_replace($expectedRewards[$cursor], $patch['patch']['maps']['rewards'] ?? []);
    $expectedPots[$cursor + 1] = $patch['patch']['values']['pot_points'] ?? $expectedPots[$cursor];
}
unset($patches, $initial);
gc_collect_cycles();
$checked = $empty = $potTargets = $collected = 0;
$frames = $checkpoints = 0;
foreach (['checkpoint' => $index['checkpoints'], 'frame' => $index['timeline']] as $mode => $steps) {
    for ($start = 0; $start < count($steps); $start += 8) {
        $batch = $service->snapshots(261009, $mode, $start, 8);
        foreach ($batch['snapshots'] as $snapshot) {
            if ($mode === 'frame') $frames++; else $checkpoints++;
            $fund = 0;
            $targets = 0;
            foreach ($snapshot['field'] as $card) {
                $stack = (int) $card['stack_count'];
                $group = intdiv($stack, 3);
                $bonus = match ((int) $card['rarity']) {2 => $group+1, 3 => $group+4, 4 => 2*$group+7, 5 => 3*$group+15, default => 0};
                $base = $stack + $bonus + (int) $card['paid_points_total'];
                $potential = $base + (int) $card['provisional_pot_points'];
                if ($card['live_total_reward'] !== $potential || $potential <= 0) throw new RuntimeException('Potential fund mismatch');
                $actual = $card['participant_count'] ? $potential : 0;
                if ($card['provisional_total_reward'] !== $actual) throw new RuntimeException('Provisional fund mismatch');
                if (array_sum(array_column($card['rankings'], 'provisional_reward_points')) + $card['provisional_taker_remainder'] !== $actual) throw new RuntimeException('Distribution mismatch');
                if (!$card['participant_count']) $empty++;
                if ($card['provisional_pot_points']) { $targets++; $potTargets++; }
                $fund += $base;
                $checked++;
            }
            if ($targets > 1) throw new RuntimeException('Pot counted more than once');
            // points_total must include the whole fund, including cards with no posts.
            $rawPot = $snapshot['points_total'] - array_sum(array_column($snapshot['players'], 'draw_points')) - $fund;
            if ($rawPot !== $expectedPots[$snapshot['log_cursor']]) throw new RuntimeException('Points total lost a card fund or pot');
            foreach ($snapshot['holder_cards'] as $card) {
                if ($card['state'] !== '_collected') continue;
                if ($card['total_reward_points'] !== $expectedRewards[$snapshot['log_cursor']][$card['event_card_id']]) throw new RuntimeException('Historical collected payout mismatch');
                $collected++;
            }
        }
        unset($batch);
        gc_collect_cycles();
        if ($start % 40 === 0) fwrite(STDERR, $mode.' checked: '.($mode === 'frame' ? $frames : $checkpoints).' memoryMB='.round(memory_get_usage(true)/1048576)."\n");
    }
}
echo json_encode(['checkpoints'=>$checkpoints,'frames'=>$frames,'field_reward_checks'=>$checked,'unposted_positive_fund_checks'=>$empty,'pot_target_checks'=>$potTargets,'collected_holder_checks'=>$collected,'peak_mb'=>round(memory_get_peak_usage(true)/1048576,1),'mismatches'=>0])."\n";
