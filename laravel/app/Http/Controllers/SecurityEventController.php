<?php

namespace App\Http\Controllers;

use App\Services\ManagementIdentity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SecurityEventController extends Controller
{
    public function handle(Request $request, ManagementIdentity $identity)
    {
        $actor = $identity->resolve($request);
        if ($request->isMethod('GET')) {
            $page = max(1, min(1000, (int) $request->query('page', 1)));
            // Subject comes from the signed server identity, never from query/body.
            return response()->json(DB::table('login_events')->where('user_id', $actor['user'])
                ->where('created_at', '>=', now()->subDays(90))->orderByDesc('id')
                ->offset(($page - 1) * 20)->limit(20)->get(['id', 'outcome', 'ip', 'user_agent', 'created_at']));
        }
        abort_unless($actor['user'] === 'auth-service', 403);
        $data = $request->validate([
            'action' => ['required', 'in:limit,event'],
            'keys' => ['required_if:action,limit', 'array', 'max:3'],
            'keys.*' => ['string', 'regex:/\A[a-f0-9]{64}\z/'],
            'maximum' => ['required_if:action,limit', 'integer', 'min:1', 'max:200'],
            'seconds' => ['required_if:action,limit', 'integer', 'min:1', 'max:3600'],
            'user_id' => ['nullable', 'string', 'max:191'],
            'outcome' => ['required_if:action,event', 'in:success,failure,limited,error'],
            'ip' => ['nullable', 'ip'],
            'user_agent' => ['nullable', 'string', 'max:256'],
        ]);
        if ($data['action'] === 'event') {
            DB::table('login_events')->insert(['user_id' => $data['user_id'] ?? null, 'outcome' => $data['outcome'],
                'ip' => $data['ip'] ?? null, 'user_agent' => $data['user_agent'] ?? null, 'created_at' => now()]);
            return response()->json(['ok' => true]);
        }
        abort_if(empty($data['keys']), 422);
        return DB::transaction(function () use ($data) {
            $retry = 0;
            // Sort to maintain one lock order across overlapping account/IP keys.
            $keys = array_values(array_unique($data['keys']));
            sort($keys);
            foreach ($keys as $key) {
                DB::table('security_rate_limits')->insertOrIgnore(['key' => $key, 'attempts' => 0, 'expires_at' => now()->addSeconds($data['seconds'])]);
                $row = DB::table('security_rate_limits')->where('key', $key)->lockForUpdate()->first();
                $expired = $row->expires_at <= now()->format('Y-m-d H:i:s');
                $attempts = $expired ? 1 : $row->attempts + 1;
                $expires = $expired ? now()->addSeconds($data['seconds'])->format('Y-m-d H:i:s') : $row->expires_at;
                DB::table('security_rate_limits')->where('key', $key)->update(['attempts' => min(1000000, $attempts), 'expires_at' => $expires]);
                if ($attempts > $data['maximum']) {
                    $retry = max($retry, max(1, strtotime($expires) - time()));
                }
            }
            return response()->json(['ok' => $retry === 0, 'retry_after' => $retry], $retry ? 429 : 200)
                ->header('Retry-After', (string) $retry);
        });
    }
}
