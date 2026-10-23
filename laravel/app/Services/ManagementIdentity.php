<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ManagementIdentity
{
    public function resolve(Request $request): array
    {
        $secret = (string) config('services.management_secret', '');
        $user = (string) $request->header('x-management-user');
        $role = (string) $request->header('x-management-role');
        $timestamp = (string) $request->header('x-management-time');
        $nonce = (string) $request->header('x-management-nonce');
        abort_unless($secret !== '' && preg_match('/\A[a-zA-Z0-9_-]{1,191}\z/', $user)
            && ctype_digit($role) && ctype_digit($timestamp) && abs(time() - (int) $timestamp) <= 60
            && preg_match('/\A[a-f0-9]{32}\z/', $nonce), 401);
        $message = implode("\n", [$timestamp, $nonce, $user, $role, $request->method(), '/'.$request->path(), hash('sha256', $request->getContent())]);
        abort_unless(hash_equals(hash_hmac('sha256', $message, $secret), (string) $request->header('x-management-signature')), 401);
        abort_unless(Cache::add('management-nonce:'.$nonce, true, 120), 409);
        return ['user' => $user, 'role' => (int) $role];
    }
}
