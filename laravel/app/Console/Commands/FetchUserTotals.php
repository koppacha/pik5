<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class FetchUserTotals extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'user:fetch-totals';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Fetch totals for all users and update the database.';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle(): int
    {
        // 全ユーザーを取得
        $users = User::all(); // ユーザー一覧（例: usersテーブル）

        foreach ($users as $user) {
            $userName = $user->user_id; // ユーザー名を取得

            // APIを実行
            $response = Http::get(route('user.total', ['id' => $userName]));

            if ($response->ok()) {
                $response->json();
                $this->info("Updated totals for user: $userName");
            } else {
                $this->error("Failed to fetch totals for user: $userName");
            }
        }
        $this->info('All users processed successfully.');
        return 0;
    }
}
