<?php

namespace Database\Seeders;

use App\Models\EventResult;
use Illuminate\Database\Seeder;

class EventResultCsvSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run(): void
    {
        EventResult::truncate();

        $object = new \SplFileObject(__DIR__ . '/data/event_results.csv');
        $object->setFlags(
            \SplFileObject::READ_CSV |
            \SplFileObject::READ_AHEAD |
            \SplFileObject::SKIP_EMPTY |
            \SplFileObject::DROP_NEW_LINE
        );

        foreach ($object as $key => $row) {
            if ($key === 0) {
                $headers = $row;
                continue;
            }

            if (!is_array($row) || count($row) !== count($headers)) {
                continue;
            }

            $values = array_combine($headers, $row);
            foreach ($values as $column => $value) {
                $values[$column] = $value === '' ? null : $value;
            }

            foreach (['id', 'event_id', 'team', 'score', 'rps', 'rps_adjust'] as $column) {
                if (isset($values[$column])) {
                    $values[$column] = (int)$values[$column];
                }
            }

            EventResult::create($values);
        }
    }
}
