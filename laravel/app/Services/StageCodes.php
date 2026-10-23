<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;

class StageCodes
{
    public static function next(string $code): string
    {
        if (preg_match('/\A4[0-9]{2}\z/', $code)) {
            return $code === '499' ? '4A0' : (string) ((int) $code + 1);
        }
        if (! preg_match('/\A4[A-Z][0-9A-Z]\z/', $code) || $code === '4ZZ') {
            throw new InvalidArgumentException('ステージ番号の範囲を超えました');
        }
        return '4'.strtoupper(base_convert((string) (base_convert(substr($code, 1), 36, 10) + 1), 10, 36));
    }

    public static function resolve(string|int $code): ?int
    {
        $code = strtoupper((string) $code);
        if (preg_match('/\A[1-9][0-9]{0,8}\z/', $code)) {
            return (int) $code;
        }
        if (! preg_match('/\A4[A-Z][0-9A-Z]\z/', $code) || ! Schema::hasTable('dandori_stages')) {
            return null;
        }
        $id = DB::table('stages')->where('stage_code', $code)->value('stage_id');
        return $id === null ? null : (int) $id;
    }

    public static function allocate(): array
    {
        // Caller holds dandori_locks row 1 for the entire transaction.
        $used = DB::table('stages')->whereBetween('stage_id', [445, 499])->pluck('stage_id')->all();
        for ($id = 445; $id <= 499; $id++) {
            if (! in_array($id, $used, false) && ! DB::table('records')->where('stage_id', $id)->exists()) {
                return [$id, (string) $id];
            }
        }
        $code = '4A0';
        while (DB::table('stages')->where('stage_code', $code)->exists()) {
            $code = self::next($code);
        }
        $id = 40000;
        while (DB::table('stages')->where('stage_id', $id)->exists()
            || DB::table('records')->where('stage_id', $id)->exists()) {
            $id++;
        }
        return [$id, $code];
    }
}
