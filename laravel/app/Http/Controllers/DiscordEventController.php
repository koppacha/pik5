<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class DiscordEventController extends Controller
{
    public function index(): JsonResponse
    {
        $botToken = config('services.discord.bot_token');
        $guildId = config('services.discord.guild_id');

        if (!$botToken || !$guildId) {
            Log::warning('Discord events API is not configured.');

            return response()->json([
                'message' => 'Discord events are not available.',
            ], 503);
        }

        $cacheSeconds = max((int) config('services.discord.events_cache_seconds', 120), 30);
        $cacheKey = 'discord:guild_scheduled_events:' . $guildId;

        try {
            $events = Cache::remember($cacheKey, $cacheSeconds, static function () use ($botToken, $guildId) {
                $response = Http::timeout(5)
                    ->acceptJson()
                    ->withToken($botToken, 'Bot')
                    ->get("https://discord.com/api/v10/guilds/{$guildId}/scheduled-events", [
                        'with_user_count' => 'true',
                    ]);

                if (!$response->successful()) {
                    Log::warning('Discord events API request failed.', [
                        'status' => $response->status(),
                    ]);

                    return null;
                }

                return collect($response->json())
                    ->filter(static function (array $event) {
                        return in_array((int) ($event['status'] ?? 0), [1, 2], true);
                    })
                    ->sortBy(static function (array $event) {
                        return $event['scheduled_start_time'] ?? '';
                    })
                    ->map(static function (array $event) {
                        $image = $event['image'] ?? null;

                        return [
                            'id' => $event['id'] ?? null,
                            'name' => $event['name'] ?? '',
                            'description' => $event['description'] ?? '',
                            'scheduled_start_time' => $event['scheduled_start_time'] ?? null,
                            'scheduled_end_time' => $event['scheduled_end_time'] ?? null,
                            'status' => $event['status'] ?? null,
                            'entity_type' => $event['entity_type'] ?? null,
                            'user_count' => $event['user_count'] ?? 0,
                            'location' => $event['entity_metadata']['location'] ?? null,
                            'image_url' => $image ? "https://cdn.discordapp.com/guild-events/{$event['id']}/{$image}.png" : null,
                        ];
                    })
                    ->values()
                    ->first();
            });

            if ($events === null) {
                return response()->json([
                    'message' => 'Discord events are not available.',
                ], 502);
            }

            return response()->json($events);
        } catch (Throwable $e) {
            Log::warning('Discord events API request threw an exception.', [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Discord events are not available.',
            ], 502);
        }
    }
}
