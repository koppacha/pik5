<?php

namespace App\Services\Tricks;

use App\Models\Deck;
use App\Models\LimitLog;
use App\Models\Player;
use App\Models\Record;
use App\Models\TrickEvent;
use App\Models\TrickEventCard;
use App\Models\TrickEventRecord;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TrickRulingService
{
    public function apply(TrickEvent $event, int $deckId, string $actor, array $data, bool $reset, Request $request): array
    {
        return DB::transaction(function () use ($event, $deckId, $actor, $data, $reset, $request): array {
            app(TrickStageAllocator::class)->lock();
            $event = TrickEvent::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();
            $card = TrickEventCard::query()->where('event_id', $event->event_id)
                ->where('deck_id', $deckId)->lockForUpdate()->firstOrFail();
            $action = $reset ? 'ranking_reset' : 'rule_changed';
            $previous = LimitLog::query()->where('event_id', $event->event_id)
                ->where('event_card_id', $card->id)->where('event', $action)
                ->where('request_id', $data['idempotency_key'])->first();
            if ($previous !== null) {
                return $previous->context['result'];
            }
            $now = app(TrickClock::class)->now($event);
            if ($event->state === 'ended' || $now->lessThan($event->start_at)
                || $now->greaterThanOrEqualTo($event->end_at) || $card->state !== '_field') {
                abort(response()->json(['message' => '開催中の切り札のみ変更できます'], 409));
            }
            $result = ['deleted' => 0, 'compensated' => 0];
            $context = [];
            if ($reset) {
                $records = Record::query()->whereIn('post_id', TrickEventRecord::query()
                    ->where('event_id', $event->event_id)->where('event_card_id', $card->id)->select('record_id'))
                    ->where('flg', '<', 2)->lockForUpdate()->get();
                $players = Player::query()->where('event_id', $event->event_id)
                    ->whereIn('name', $records->pluck('user_id')->unique())->orderBy('id')->lockForUpdate()->get();
                foreach ($records as $record) {
                    $record->flg = 2;
                    $record->post_memo = ($record->post_memo === '' ? '' : $record->post_memo."\n")
                        .'管理者権限による削除（'.$now->setTimezone('Asia/Tokyo')->format('Y-m-d H:i:s').'）';
                    $record->save();
                }
                // Keep payments, submission history, stack and paid_points_total intact.
                $card->post_count = 0;
                $card->top_player = null;
                $card->save();
                foreach ($players as $player) {
                    $player->draw_points += 5;
                    $player->ranking_reset_tax_exempt = true;
                    $player->save();
                    LimitLog::query()->create([
                        'event' => 'ranking_reset_compensation', 'event_id' => $event->event_id,
                        'event_card_id' => $card->id, 'card_id' => $deckId, 'actor_name' => $actor,
                        'affected_player_name' => $player->name, 'points_delta' => 5,
                        'remaining_draw_points' => $player->draw_points,
                        'context' => ['reset_key' => $data['idempotency_key']],
                    ]);
                }
                $result = ['deleted' => $records->count(), 'compensated' => $players->count()];
                $context['record_ids'] = $records->pluck('post_id')->all();
            } else {
                $deck = Deck::query()->whereKey($deckId)->lockForUpdate()->firstOrFail();
                $values = array_intersect_key($data, array_flip(['title', 'rule_name', 'text', 'difficulty']));
                $context['before'] = $deck->only(array_keys($values));
                $deck->fill($values)->save();
                $card->difficulty = $deck->difficulty;
                $card->save();
                app(TrickStageAllocator::class)->ensure($event, $deck);
                $context['after'] = $values;
            }
            LimitLog::query()->create([
                'event' => $action, 'event_id' => $event->event_id, 'event_card_id' => $card->id,
                'card_id' => $deckId, 'actor_name' => $actor, 'request_id' => $data['idempotency_key'],
                'route' => $request->path(), 'context' => [...$context, 'result' => $result],
            ]);

            return $result;
        });
    }
}
