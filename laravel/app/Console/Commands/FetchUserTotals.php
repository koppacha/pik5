<?php

namespace App\Console\Commands;

use App\Models\Record;
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
        $users = Record::distinct()->pluck('user_id'); // ユーザー一覧

        foreach ($users as $user) {
            // APIを実行
            $response = Http::get(route('user.total', ['id' => $user]));

            if ($response->ok()) {
                $response->json();
                $this->info("Updated totals for user: $user");
            } else {
                $this->error("Failed to fetch totals for user: $user");
            }
        }
        $this->info('All users processed successfully.');
        return 0;
    }
}
