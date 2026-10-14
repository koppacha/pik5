<?php

// Read-only characterization of the current calculations, not desired behavior.
// Run via stdin in the Laravel container, from its application directory.
require 'app/Services/Tricks/TrickRuleCalculator.php';
require 'app/Services/Tricks/TrickRewardDistributor.php';

$rules = new App\Services\Tricks\TrickRuleCalculator();
$distributor = new App\Services\Tricks\TrickRewardDistributor();
$checks = 0;
$check = function (bool $condition, string $label) use (&$checks): void {
    if (! $condition) {
        throw new RuntimeException($label);
    }
    $checks++;
};
for ($base = 0; $base <= 200; $base++) {
    for ($difficulty = 1; $difficulty <= 5; $difficulty++) {
        $check($rules->totalReward($base, 0, 2) === $base, 'multi reward');
        $check($rules->totalReward($base, 0, 1) === $base, 'single reward');
        $check($rules->totalReward($base, 0, 0) === 0, 'empty reward');
    }
}
$groups = [['A'], ['B'], ['C'], ['D']];
$check($distributor->distribute(20, $groups)['distribution'] === ['A' => 17, 'B' => 2, 'C' => 1], 'concentration');
$check($distributor->distribute(5, $groups)['distribution'] === ['A' => 2, 'B' => 2, 'C' => 1], 'priority counterexample');
$tie = $distributor->distribute(2, [['A', 'B', 'C'], ['D']]);
$check($tie['distribution'] === [] && $distributor->lastPlaceRemainder($tie['taker_remainder'], ['D']) === ['D' => 2], 'inversion');
$check($rules->totalReward(10, 0, 2) - $rules->totalReward(9, 0, 2) === 1, 'threshold');
$check($rules->requiredHand(4) === 4, 'emergency floor below take cost');
echo json_encode(['checks' => $checks, 'status' => 'passed', 'scope' => 'pure calculations; no database access']), PHP_EOL;
