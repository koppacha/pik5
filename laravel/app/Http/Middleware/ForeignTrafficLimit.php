<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ForeignTrafficLimit
{
    public function handle(Request $request, Closure $next)
    {
        $country = $request->attributes->get('verified_client_country');
        if (! $country || $country === 'JP' || ! Schema::hasTable('security_rate_limits')) return $next($request);
        // Only verified country metadata can enter this limiter. No DNS-based geolocation.
        $key = hash('sha256', 'foreign:'.$request->ip());
        $limited = DB::transaction(function () use ($key) {
            DB::table('security_rate_limits')->insertOrIgnore(['key' => $key, 'attempts' => 0, 'expires_at' => now()->addMinute()]);
            $row = DB::table('security_rate_limits')->where('key', $key)->lockForUpdate()->first();
            $expired = $row->expires_at <= now()->format('Y-m-d H:i:s');
            $count = $expired ? 1 : min(1000000, $row->attempts + 1);
            DB::table('security_rate_limits')->where('key', $key)->update(['attempts' => $count,
                'expires_at' => $expired ? now()->addMinute() : $row->expires_at]);
            return $count > 120;
        });
        if ($limited) return response()->json(['message' => 'Too many requests'], 429)->header('Retry-After', '60');
        return $next($request);
    }
}
