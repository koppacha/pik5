<?php

namespace Database\Seeders;

use App\Models\EventResult;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class EventResultCsvSeeder extends Seeder
{
    public function run(): void
    {
        $headers = ['id', 'event_id', 'event_title', 'sub_title', 'category', 'user_id', 'team', 'score', 'rps', 'rps_adjust', 'result'];
        $object = new \SplFileObject(__DIR__ . '/data/event_results.csv');
        $object->setFlags(\SplFileObject::READ_CSV | \SplFileObject::SKIP_EMPTY | \SplFileObject::DROP_NEW_LINE);
        $rows = [];
        $ids = [];
        foreach ($object as $key => $row) {
            if ($key === 0) {
                if ($row !== $headers) {
                    throw new RuntimeException('Invalid event results CSV header.');
                }
                continue;
            }
            if ($row === false || $row === [null]) {
                continue;
            }
            if (count($row) !== count($headers)) {
                throw new RuntimeException('Invalid event results CSV row at line ' . ($key + 1));
            }
            $values = array_combine($headers, $row);
            foreach ($values as $column => $value) {
                $values[$column] = $value === '' ? null : $value;
            }
            foreach (['id', 'event_id', 'team', 'score', 'rps', 'rps_adjust'] as $column) {
                if (isset($values[$column])) {
                    if (!preg_match('/^-?\d+$/', $values[$column])) {
                        throw new RuntimeException('Invalid numeric column at line ' . ($key + 1));
                    }
                    $values[$column] = (int)$values[$column];
                }
            }
            if (($values['id'] ?? 0) <= 0 || ($values['event_id'] ?? 0) <= 0 || empty($values['user_id']) || empty($values['category'])) {
                throw new RuntimeException('Missing event identity at line ' . ($key + 1));
            }
            if (isset($ids[$values['id']])) {
                throw new RuntimeException('Duplicate event result ID in CSV.');
            }
            $ids[$values['id']] = true;
            $rows[] = $values;
        }
        if ($rows === []) {
            throw new RuntimeException('Empty event results CSV.');
        }

        DB::transaction(static function () use ($rows, $headers) {
            // Refuse to overwrite a different event that happens to use a CSV ID.
            $existing = EventResult::whereIn('id', array_column($rows, 'id'))->lockForUpdate()->get()->keyBy('id');
            foreach ($rows as $row) {
                $current = $existing->get($row['id']);
                if ($current && ((int)$current->event_id !== $row['event_id'] || $current->category !== $row['category'])) {
                    throw new RuntimeException('CSV ID conflicts with an existing event result.');
                }
            }
            EventResult::upsert($rows, ['id'], array_values(array_diff($headers, ['id'])));
        });
    }
}
