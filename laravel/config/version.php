<?php

$projectFile = dirname(__DIR__).'/project.json';
$project = [];
$projectJson = @file_get_contents($projectFile);

if ($projectJson !== false) {
    try {
        $decoded = json_decode($projectJson, true, 512, JSON_THROW_ON_ERROR);
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
$recordPrefix = $digits !== ''
    ? substr(str_pad($digits, 3, '0', STR_PAD_RIGHT), 0, 3)
    : '300';

return [
    'app' => $version,
    'record_prefix' => $recordPrefix,
];
