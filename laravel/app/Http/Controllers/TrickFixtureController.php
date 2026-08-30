<?php

namespace App\Http\Controllers;

use App\Models\TrickEvent;
use App\Services\Tricks\TrickOperationAuthorizer;
use App\Services\Tricks\TrickTestFixtureService;
use DomainException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TrickFixtureController extends Controller
{
    public function create(
        Request $request,
        TrickOperationAuthorizer $authorization,
        TrickTestFixtureService $fixtures,
    ): JsonResponse {
        $validated = $request->validate([
            'event_id' => ['required', 'integer'],
            'title' => ['nullable', 'string', 'max:255'],
            'start_at' => ['nullable', 'date'],
            'end_at' => ['nullable', 'date'],
            'debug_now' => ['nullable', 'date'],
            'random_seed' => ['nullable', 'integer', 'min:1'],
            'players' => ['nullable', 'array', 'max:20'],
            'field_player' => ['nullable', 'string', 'max:255'],
        ]);
        $eventId = (int) $validated['event_id'];
        $authorization->assertFixture($request, $eventId);

        try {
            return response()->json($fixtures->create($eventId, $validated), 201);
        } catch (DomainException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }

    public function teardown(
        Request $request,
        int $eventId,
        TrickOperationAuthorizer $authorization,
        TrickTestFixtureService $fixtures,
    ): JsonResponse {
        $authorization->assertFixture($request, $eventId);
        $event = TrickEvent::query()->where('event_id', $eventId)->first();
        if ($event !== null && ! $event->test_mode) {
            return response()->json(['message' => '通常大会はfixture teardownできません'], 403);
        }

        try {
            return response()->json($fixtures->teardown($eventId));
        } catch (DomainException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
    }
}
