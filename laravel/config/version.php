<?php

$versionFile = dirname(__DIR__, 2).'/VERSION';
$version = is_readable($versionFile) ? trim((string) file_get_contents($versionFile)) : '';

// 例: 3.13 -> 313
$digits = preg_replace('/\D+/', '', $version);
$recordPrefix = substr(str_pad($digits, 3, '0', STR_PAD_RIGHT), 0, 3);

return [
    'app' => $version,
    'record_prefix' => $recordPrefix ?: '000',
];
