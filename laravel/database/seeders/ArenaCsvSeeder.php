<?php

namespace Database\Seeders;

use App\Models\Arena;
use App\Models\Record;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;

class ArenaCsvSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run(): void
    {
        $object = new \SplFileObject(__DIR__ . '/data/arenas.csv');
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

            Arena::create($values);
        }
    }
}
