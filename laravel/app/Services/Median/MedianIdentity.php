<?php

namespace App\Services\Median;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class MedianIdentity
{
    public function resolve(Request $request): array
    {
        $secret = (string) (config('services.median_secret') ?: config('services.management_secret'));
        $principal = (string) $request->header('x-median-principal');
        $time = (string) $request->header('x-median-time');
        $nonce = (string) $request->header('x-median-nonce');
        abort_unless($secret !== '' && strlen($principal) <= 2048 && ctype_digit($time) && abs(time() - (int) $time) <= 60
            && preg_match('/\A[a-f0-9]{32}\z/', $nonce), 401);
        $message = implode("\n", [$time, $nonce, $principal, $request->method(), '/'.$request->path(), hash('sha256', $request->getContent())]);
        abort_unless(hash_equals(hash_hmac('sha256', $message, $secret), (string) $request->header('x-median-signature')), 401);
        abort_unless(Cache::add('median-nonce:'.$nonce, true, 120), 409);
        $identity = json_decode(base64_decode($principal, true) ?: '', true);
        abort_unless(is_array($identity) && in_array($identity['kind'] ?? '', ['visitor', 'guest', 'user'], true), 401);
        if ($identity['kind'] === 'visitor') return ['key' => null];
        $name = $identity['name'] ?? null;
        abort_unless(is_string($name) && trim($name) !== '' && mb_strlen($name) <= 80 && !preg_match('/[\x00-\x1f]/u', $name), 422);
        $id = $identity['kind'] === 'user' ? ($identity['userId'] ?? '') : $name;
        abort_unless(is_string($id) && $id !== '' && strlen($id) <= 512, 401);
        return ['key' => $identity['kind'].':'.hash('sha256', $id), 'name' => $name];
    }
}
