<?php

namespace Database\Seeders;

use App\Models\Battle;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;

class BattleCsvSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run(): void
    {
        // 実行前にテーブルを空にする
        Battle::truncate();

        $object = new \SplFileObject(__DIR__ . '/data/battles.csv');
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

            Battle::create($values);
        }
    }
}
