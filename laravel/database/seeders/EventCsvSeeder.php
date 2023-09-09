<?php

namespace Database\Seeders;

use App\Models\Event;
use Illuminate\Database\Seeder;

class EventCsvSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run(): void
    {
        $object = new \SplFileObject(__DIR__ . '/data/events.csv');
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

            $values = array_combine($headers, $row);

            Event::create($values);
        }
    }
}
