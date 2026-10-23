<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class VerifiedClientIp
{
    public function handle(Request $request, Closure $next)
    {
        $ip = (string) $request->header('x-client-ip');
        $timestamp = (string) $request->header('x-client-time');
        $secret = (string) config('services.management_secret', '');
        if ($ip !== '') {
            abort_unless($secret !== '' && filter_var($ip, FILTER_VALIDATE_IP) && ctype_digit($timestamp) && abs(time() - (int) $timestamp) <= 60, 403);
            $country = (string) $request->header('x-client-country', '');
            abort_unless($country === '' || preg_match('/\A[A-Z]{2}\z/', $country), 403);
            $message = implode("\n", [$timestamp, $request->method(), '/'.$request->path(), $ip, $country]);
            abort_unless(hash_equals(hash_hmac('sha256', $message, $secret), (string) $request->header('x-client-signature')), 403);
            $request->server->set('REMOTE_ADDR', $ip);
            // The signed, normalized address is authoritative at this boundary.
            $request->headers->remove('x-forwarded-for');
            $request->headers->remove('x-real-ip');
            $request->attributes->set('verified_client_country', $country);
        }
        return $next($request);
    }
}
