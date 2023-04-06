<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use App\Models\User;

class UsersTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run(): void
    {
        $data = [
//            [
//                'user_name' => 'タマゴムシ',
//                'user_id' => 'tamagomushi',
//                'email' => 'tamagomushi@pik5.net',
//                'password' => Hash::make('password')
//            ],
//            [
//                'user_name' => 'サライムシ',
//                'user_id' => 'saraimushi',
//                'email' => 'saraimushi@pik5.net',
//                'password' => Hash::make('password')
//            ],
//            [
//                'user_name' => 'ウジャダニ',
//                'user_id' => 'ujadani',
//                'email' => 'ujadani@pik5.net',
//                'password' => Hash::make('password')
//            ],
//            [
//                'user_name' => 'ウジンコ',
//                'user_id' => 'ujinko',
//                'email' => 'ujinko@pik5.net',
//                'password' => Hash::make('password')
//            ],
//            [
//                'user_name' => 'トテツチホカシ',
//                'user_id' => 'totetsuchihokashi',
//                'email' => 'totetsuchihokashi@pik5.net',
//                'password' => Hash::make('password')
//            ],
        ];
        DB::table('users')->insert($data);
    }
}
