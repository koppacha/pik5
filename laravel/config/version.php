<?php

$projectFile = dirname(__DIR__, 2).'/project.json';
$project = [];

if (is_readable($projectFile)) {
    try {
        $decoded = json_decode((string) file_get_contents($projectFile), true, 512, JSON_THROW_ON_ERROR);
        if (is_array($decoded)) {
            $project = $decoded;
        }
    } catch (\JsonException $e) {
        $project = [];
    }
}

$version = isset($project['version']) ? trim((string) $project['version']) : '';

// 例: 3.13 -> 313
$digits = preg_replace('/\D+/', '', $version);
$recordPrefix = substr(str_pad($digits, 3, '0', STR_PAD_RIGHT), 0, 3);

return [
    'app' => $version,
    'record_prefix' => $recordPrefix ?: '300',
];
