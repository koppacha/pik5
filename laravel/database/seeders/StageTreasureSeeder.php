<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class StageTreasureSeeder extends Seeder
{
    public function run(): void
    {
        $file = fopen(__DIR__ . '/data/stage_treasures.csv', 'r');
        if ($file === false) {
            throw new \RuntimeException('stage_treasures.csv could not be opened');
        }

        try {
            fgetcsv($file);
            $rows = [];
            while (($data = fgetcsv($file)) !== false) {
                if (count($data) !== 11) {
                    throw new \RuntimeException('Invalid stage treasure row');
                }
                $rows[] = [
                    'legacy_object_id' => (int) $data[0],
                    'stage_id' => (int) $data[1],
                    'floor' => (int) $data[2],
                    'object_name' => $data[3],
                    'quantity' => (int) $data[4],
                    'value' => (int) $data[5],
                    'value_na' => $data[6] === '' ? null : (int) $data[6],
                    'value_eu' => $data[7] === '' ? null : (int) $data[7],
                    'weight_jp' => $data[8] === '' ? null : (int) $data[8],
                    'weight_na' => $data[9] === '' ? null : (int) $data[9],
                    'weight_eu' => $data[10] === '' ? null : (int) $data[10],
                ];
            }
        } finally {
            fclose($file);
        }

        DB::transaction(static function () use ($rows): void {
            DB::table('stage_treasures')->whereBetween('stage_id', [201, 230])->delete();
            foreach (array_chunk($rows, 100) as $chunk) {
                DB::table('stage_treasures')->insert($chunk);
            }
        });
    }
}
