<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;

class BackupDatabase extends Command
{
    protected $signature = 'db:backup
        {--path= : Backup destination directory}
        {--keep-days= : Delete backups older than this many days}';

    protected $description = 'Create a compressed MySQL backup for point-in-time recovery.';

    public function handle(): int
    {
        $connection = config('database.default');
        $database = config("database.connections.{$connection}");

        if (($database['driver'] ?? null) !== 'mysql') {
            $this->error('The db:backup command currently supports MySQL only.');
            return self::FAILURE;
        }

        $dumpBinary = (new ExecutableFinder())->find('mysqldump')
            ?: (new ExecutableFinder())->find('mariadb-dump');

        if ($dumpBinary === null) {
            $this->error('mysqldump or mariadb-dump is not installed.');
            return self::FAILURE;
        }

        $path = $this->option('path') ?: config('database.backup.path');
        $keepDays = max(1, (int)($this->option('keep-days') ?: config('database.backup.keep_days')));
        File::ensureDirectoryExists($path, 0700);

        $name = sprintf(
            '%s-%s.sql.gz',
            preg_replace('/[^A-Za-z0-9_-]/', '_', $database['database']),
            now()->format('Ymd-His')
        );
        $filename = rtrim($path, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.$name;
        $stream = gzopen($filename, 'wb9');

        if ($stream === false) {
            $this->error("Unable to create backup: {$filename}");
            return self::FAILURE;
        }

        $errors = '';
        $process = new Process([
            $dumpBinary,
            '--host='.$database['host'],
            '--port='.$database['port'],
            '--user='.$database['username'],
            '--single-transaction',
            '--master-data=2',
            '--quick',
            '--no-tablespaces',
            '--routines',
            '--events',
            '--triggers',
            $database['database'],
        ], null, ['MYSQL_PWD' => $database['password']]);
        $process->setTimeout(null);
        $process->run(function ($type, $buffer) use ($stream, &$errors) {
            if ($type === Process::OUT) {
                gzwrite($stream, $buffer);
                return;
            }

            $errors .= $buffer;
        });
        gzclose($stream);

        if (! $process->isSuccessful()) {
            File::delete($filename);
            $this->error(trim($errors) ?: 'mysqldump failed.');
            return self::FAILURE;
        }

        chmod($filename, 0600);
        $this->pruneBackups($path, $database['database'], $keepDays);
        $this->info("Backup created: {$filename}");

        return self::SUCCESS;
    }

    private function pruneBackups(string $path, string $database, int $keepDays): void
    {
        $prefix = preg_replace('/[^A-Za-z0-9_-]/', '_', $database).'-';
        $threshold = now()->subDays($keepDays)->getTimestamp();

        foreach (File::files($path) as $file) {
            if (str_starts_with($file->getFilename(), $prefix) && $file->getMTime() < $threshold) {
                File::delete($file->getPathname());
            }
        }
    }
}
