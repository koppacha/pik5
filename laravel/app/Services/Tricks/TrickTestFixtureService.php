<?php

namespace App\Services\Tricks;

use App\Models\Deck;
use App\Models\LimitLog;
use App\Models\Player;
use App\Models\Record;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use Carbon\CarbonImmutable;
use DomainException;
use Illuminate\Support\Facades\DB;

class TrickTestFixtureService
{
    public const EVENT_ID_MIN = 900000;

    public const EVENT_ID_MAX = 999999;

    public function __construct(
        private readonly TrickEventInitializer $initializer,
        private readonly TrickGameService $game,
    ) {
    }

    public function inspect(int $eventId, array $players = []): array
    {
        $this->assertEventId($eventId);

        return [
            'event_id' => $eventId,
            'test_mode' => true,
            'deck_count' => TrickEventInitializer::DECK_SIZE,
            'players' => $this->normalizePlayers($players),
            'exists' => TrickEvent::query()->where('event_id', $eventId)->exists(),
        ];
    }

    public function create(int $eventId, array $options = []): array
    {
        $this->assertEventId($eventId);
        $players = $this->normalizePlayers($options['players'] ?? []);
        $seed = max(1, (int) ($options['random_seed'] ?? $eventId));
        $now = CarbonImmutable::parse($options['debug_now'] ?? now());
        $startAt = CarbonImmutable::parse($options['start_at'] ?? $now->subHour());
        $endAt = CarbonImmutable::parse($options['end_at'] ?? $now->addHours(48));
        if ($endAt->lessThanOrEqualTo($startAt) || $now->lessThan($startAt) || $now->greaterThanOrEqualTo($endAt)) {
            throw new DomainException('fixtureの時刻は開催期間内で指定してください');
        }

        return DB::transaction(function () use ($eventId, $options, $players, $seed, $now, $startAt, $endAt): array {
            if (TrickEvent::query()->where('event_id', $eventId)->lockForUpdate()->exists()) {
                throw new DomainException('同じevent_idの大会が既に存在します');
            }

            $event = TrickEvent::query()->create([
                'event_id' => $eventId,
                'title' => (string) ($options['title'] ?? "Playwright fixture {$eventId}"),
                'start_at' => $startAt,
                'end_at' => $endAt,
                'state' => 'scheduled',
                'debug' => true,
                'test_mode' => true,
                'debug_now' => $now,
                'random_seed' => $seed,
            ]);
            $creator = $this->creator($eventId);
            $rows = [];
            for ($index = 1; $index <= TrickEventInitializer::DECK_SIZE; $index++) {
                $originStageId = 200 + (($index - 1) % 30) + 1;
                $rows[] = [
                    'eventId' => $eventId,
                    'event_id' => null,
                    'card_id' => null,
                    'stage_id' => null,
                    'origin_stage_id' => $originStageId,
                    'title' => "fixture card {$eventId}-{$index}",
                    'rule_name' => "fixture rule {$index}",
                    'state' => '_eligible',
                    'text' => "Playwright fixture {$eventId} card {$index}",
                    'difficulty' => (($index - 1) % 5) + 1,
                    'rewards' => 0,
                    'creator' => $creator,
                    'taker' => null,
                    'top_player' => null,
                    'count' => 0,
                    'post_count' => 0,
                    'stack_count' => 0,
                    'limit' => null,
                    'limit_at' => null,
                    'taken_at' => null,
                    'collected_at' => null,
                    'stack_parent_id' => null,
                    'drawn_order' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            Deck::query()->insert($rows);
            $deckIds = Deck::query()->where('creator', $creator)->pluck('id');
            $initialized = $this->initializer->initialize($event, $deckIds);

            foreach ($players as $playerOptions) {
                $this->game->join($event->fresh(), $playerOptions['name']);
            }
            foreach ($players as $playerOptions) {
                $name = $playerOptions['name'];
                $handCount = min(20, max(0, (int) $playerOptions['hand_count']));
                $cards = TrickEventCard::query()->where('event_id', $eventId)->where('state', '_deck')
                    ->orderBy('id')->limit($handCount)->get();
                foreach ($cards as $order => $card) {
                    $card->update(['state' => $name, 'rarity' => 1, 'draw_count' => 1, 'drawn_order' => $order + 1]);
                }
                Player::query()->where('event_id', $eventId)->where('name', $name)->update([
                    'draw_points' => (int) $playerOptions['points'],
                    'card_count' => $cards->count(),
                ]);
            }
            $fieldPlayer = trim((string) ($options['field_player'] ?? ''));
            if ($fieldPlayer !== '') {
                $fieldCard = TrickEventCard::query()->where('event_id', $eventId)->where('state', $fieldPlayer)
                    ->orderBy('drawn_order')->first();
                if ($fieldCard === null) {
                    throw new DomainException('field_playerには手札を準備してください');
                }
                $this->game->take($event->fresh(), $fieldPlayer, $fieldCard->deck_id);
            }

            return [
                'event_id' => $eventId,
                'initialized' => $initialized,
                'counts' => $this->counts($eventId),
                'players' => Player::query()->where('event_id', $eventId)->orderBy('id')->get()->toArray(),
            ];
        });
    }

    public function teardown(int $eventId): array
    {
        $this->assertEventId($eventId);

        return DB::transaction(function () use ($eventId): array {
            $event = TrickEvent::query()->where('event_id', $eventId)->lockForUpdate()->first();
            if ($event !== null && ! $event->test_mode) {
                throw new DomainException('通常大会はfixture teardownできません');
            }
            $stageIds = DB::table('stages')->where('stage_name', 'like', "fixture card {$eventId}-%")
                ->pluck('stage_id');
            Record::query()->whereIn('stage_id', $stageIds)->delete();
            LimitLog::query()->where('event_id', $eventId)->delete();
            Player::query()->where('event_id', $eventId)->delete();
            $event?->delete();
            Deck::query()->where('creator', $this->creator($eventId))->delete();
            DB::table('stages')->whereIn('stage_id', $stageIds)->delete();

            return ['event_id' => $eventId, 'counts' => $this->counts($eventId)];
        });
    }

    private function counts(int $eventId): array
    {
        return [
            'events' => TrickEvent::query()->where('event_id', $eventId)->count(),
            'decks' => Deck::query()->where('creator', $this->creator($eventId))->count(),
            'event_cards' => TrickEventCard::query()->where('event_id', $eventId)->count(),
            'players' => Player::query()->where('event_id', $eventId)->count(),
            'logs' => LimitLog::query()->where('event_id', $eventId)->count(),
            'records' => Record::query()->whereIn('stage_id', function ($query) use ($eventId) {
                $query->select('stage_id')->from('stages')
                    ->where('stage_name', 'like', "fixture card {$eventId}-%");
            })->count(),
            'stages' => DB::table('stages')->where('stage_name', 'like', "fixture card {$eventId}-%")->count(),
        ];
    }

    private function normalizePlayers(array $players): array
    {
        return collect($players)->map(function ($player): array {
            $player = is_string($player) ? ['name' => $player] : (array) $player;
            $name = trim((string) ($player['name'] ?? ''));
            if ($name === '' || mb_strlen($name) > 255) {
                throw new DomainException('fixture player nameが不正です');
            }

            return [
                'name' => $name,
                'points' => (int) ($player['points'] ?? 5),
                'hand_count' => (int) ($player['hand_count'] ?? 0),
            ];
        })->unique('name')->values()->all();
    }

    private function assertEventId(int $eventId): void
    {
        if ($eventId < self::EVENT_ID_MIN || $eventId > self::EVENT_ID_MAX) {
            throw new DomainException('fixture event_idは900000〜999999で指定してください');
        }
    }

    private function creator(int $eventId): string
    {
        return "codex_fixture_{$eventId}";
    }
}
