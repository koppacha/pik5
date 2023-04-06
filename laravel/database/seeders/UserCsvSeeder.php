<?php

namespace Database\Seeders;

use App\Models\Record;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;

class UserCsvSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run(): void
    {
        $object = new \SplFileObject(__DIR__ . '/data/users.csv');
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

            User::create($values);
        }
    }
}
