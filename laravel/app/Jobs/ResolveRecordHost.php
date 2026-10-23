<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ResolveRecordHost implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 5;

    public function __construct(public int $postId, public string $ip) {}

    public function handle(): void
    {
        if (! filter_var($this->ip, FILTER_VALIDATE_IP)) return;
        try {
            $host = Cache::remember('record-ptr:'.hash('sha256', $this->ip), 86400, function () {
                $process = new \Symfony\Component\Process\Process([PHP_BINARY, '-r', 'echo gethostbyaddr($argv[1]);', $this->ip]);
                $process->setTimeout(2);
                $process->run();
                return $process->isSuccessful() ? trim($process->getOutput()) : '';
            });
        } catch (\Throwable $error) {
            return;
        }
        DB::table('records')->where('post_id', $this->postId)->where('user_ip', $this->ip)
            ->update(['user_host' => $host === $this->ip ? '' : substr($host, 0, 255)]);
    }
}
