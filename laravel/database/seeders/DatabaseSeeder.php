<?php

namespace Database\Seeders;

// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * @return void
     */
    public function run(): void
    {
        // \App\Models\User::factory(10)->create();

        // \App\Models\User::factory()->create([
        //     'name' => 'Test User',
        //     'email' => 'test@example.com',
        // ]);
        $this->call([
//            RecordSeeder::class,
            UsersTableSeeder::class,
            StageCsvSeeder::class,
            RecordCsvSeeder::class,
            UserCsvSeeder::class,
            KeywordSeeder::class,
            EventCsvSeeder::class,
            ArenaCsvSeeder::class
        ]);
    }
}
