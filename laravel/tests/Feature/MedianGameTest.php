<?php

namespace Tests\Feature;

use App\Services\Median\MedianNumbers;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class MedianGameTest extends TestCase
{
    use RefreshDatabase;
    private string $secret;
    private array $host = ['kind' => 'guest', 'name' => 'Synthetic Host'];
    private array $guest = ['kind' => 'guest', 'name' => 'Synthetic Guest'];
    private ?string $gameId = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->secret = bin2hex(random_bytes(32));
        config(['services.median_secret' => $this->secret]);
    }

    private function requestAs(array $who, ?string $action = null, array $data = [])
    {
        $method = $action === null ? 'GET' : 'POST';
        $body = $action === null ? '' : json_encode(['action' => $action, 'gameId' => $this->gameId, ...$data]);
        $principal = base64_encode(json_encode($who));
        $time = (string) time();
        $nonce = bin2hex(random_bytes(16));
        $message = implode("\n", [$time, $nonce, $principal, $method, '/api/median', hash('sha256', $body)]);
        $this->flushHeaders();
        return $this->call($method, '/api/median', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_MEDIAN_PRINCIPAL' => $principal, 'HTTP_X_MEDIAN_TIME' => $time, 'HTTP_X_MEDIAN_NONCE' => $nonce,
            'HTTP_X_MEDIAN_SIGNATURE' => hash_hmac('sha256', $message, $this->secret)], $body);
    }

    private function start(): array
    {
        $result = $this->requestAs($this->host, 'join', ['host' => true])->assertOk()->json('game');
        $this->gameId = $result['id'];
        $this->requestAs($this->guest, 'join', ['host' => false])->assertOk();
        $this->requestAs($this->host, 'queue', ['text' => "First prompt\nSecond prompt", 'queueVersion' => 0])->assertOk();
        return $result;
    }

    private function answer(array $who, string $value, string $raw = 'synthetic expression')
    {
        return $this->requestAs($who, 'answer', ['roundId' => 1, 'answer' => ['raw' => $raw, 'value' => $value, 'display' => $value, 'valid' => true, 'error' => null]]);
    }

    private function finishDisconnectedClose(): void
    {
        $this->travel(9)->seconds();
        $this->requestAs($this->host)->assertOk()->assertJsonPath('game.phase', 'closed');
    }

    public function test_closing_collects_latest_input_and_rejects_delayed_autosaves(): void
    {
        $this->start();
        $this->requestAs($this->host, 'show')->assertOk();
        $this->answer($this->host, '1e+0')->assertOk();
        $this->answer($this->guest, '2e+0')->assertOk();
        $this->requestAs($this->host, 'close')->assertOk()->assertJsonPath('game.phase', 'closing');
        $this->requestAs($this->host, 'reveal')->assertStatus(409);
        $this->answer($this->guest, '9e+0')->assertStatus(409);
        $state = $this->requestAs($this->guest)->assertOk()->json('game');
        $this->assertTrue($state['round']['awaitingFinal']);
        $this->assertArrayNotHasKey('answers', $state['round']);
        $this->requestAs($this->guest, 'answer', ['roundId'=>1, 'closeToken'=>'wrong',
            'answer'=>['raw'=>'4','value'=>'4e+0','display'=>'4','valid'=>true]])->assertStatus(409);
        $this->requestAs($this->guest, 'answer', ['roundId'=>1, 'closeToken'=>$state['round']['closeToken'],
            'answer'=>['raw'=>'4','value'=>'4e+0','display'=>'4','valid'=>true]])->assertOk()->assertJsonPath('game.phase','closed');
        $this->answer($this->guest, '5e+0')->assertStatus(409);
        $result = $this->requestAs($this->host, 'reveal')->assertOk()->json('game');
        $this->assertSame('4', $result['round']['answers'][1]['raw']);
        $this->assertSame([-1,2], array_column($result['players'], 'score'));
    }

    public function test_secrets_are_filtered_even_from_host_and_scoring_is_atomic(): void
    {
        $host = $this->start();
        $this->requestAs($this->host, 'show')->assertOk();
        $this->answer($this->host, '1e+0')->assertOk();
        $this->answer($this->guest, '2e+0', '  1 + 1  ')->assertOk()->assertJsonPath('game.round.own.raw', '  1 + 1  ');
        foreach ([$this->host, $this->guest, ['kind' => 'visitor']] as $who) {
            $state = $this->requestAs($who)->assertOk()->json('game');
            $this->assertArrayNotHasKey('answers', $state['round']);
            $this->assertArrayNotHasKey('drafts', $state['round']);
            if ($who !== $this->host) {
                $this->assertArrayNotHasKey('queue', $state);
                $this->assertArrayNotHasKey('inboxCount', $state);
            }
        }
        $this->requestAs($this->guest, 'close')->assertForbidden();
        $this->requestAs($this->host, 'close')->assertOk()->assertJsonPath('game.players.0.score', 0);
        $this->finishDisconnectedClose();
        $stored = json_decode(DB::table('median_games')->value('state'), true);
        $this->assertSame(-1, $stored['players'][$host['me']]['score']);
        $this->assertCount(2, $stored['round']['answers']);
        $this->requestAs($this->host, 'close')->assertStatus(409);
        $this->answer($this->guest, '3e+0')->assertStatus(409);
        $revealed = $this->requestAs($this->host, 'reveal')->assertOk()->json('game');
        $this->assertSame([-1, 2], array_column($revealed['round']['answers'], 'points'));
        $this->assertSame([-1, 2], array_column($revealed['players'], 'score'));
        $this->requestAs($this->host, 'reveal')->assertStatus(409);
    }

    public function test_upper_unique_median_negative_and_huge_numbers(): void
    {
        $answers = array_map(fn ($v) => ['value' => $v], ['1e+0','1e+0','1e+0','1e+0','1e+0','2e+0','3e+0','4e+0','5e+0','6e+0']);
        $scored = MedianNumbers::score($answers);
        $this->assertTrue($scored[7]['median']);
        $this->assertSame([-1,-1,-1,-1,-1,0,0,2,0,-1], array_column($scored, 'points'));
        $this->assertSame([2,2], array_column(MedianNumbers::score([['value'=>'0e+0'],['value'=>'0e+0']]), 'points'));
        foreach ([['-1e+1000','-1e+2'], ['-1e-100','0e+0'], ['0e+0','1e-100'], ['9e+999','1e+1000'], ['1.00000000000000000000000000001e+0','1.00000000000000000000000000002e+0']] as [$a,$b]) {
            $this->assertLessThan(0, MedianNumbers::compare($a, $b));
        }
    }

    public function test_rejoining_during_a_round_keeps_original_participant_reveal_order(): void
    {
        $this->start();
        $third = ['kind'=>'guest', 'name'=>'Third'];
        $this->requestAs($third, 'join', ['host'=>false])->assertOk();
        $this->requestAs($this->guest, 'leave')->assertOk();
        $this->requestAs($this->host, 'show')->assertOk();
        $this->requestAs($this->guest, 'join', ['host'=>false])->assertOk();
        $this->answer($this->host, '1e+0')->assertOk();
        $this->answer($this->guest, '2e+0')->assertOk();
        $this->answer($third, '3e+0')->assertOk();
        $this->requestAs($this->host, 'close')->assertOk();
        $this->finishDisconnectedClose();
        $game = $this->requestAs($this->host, 'reveal')->assertOk()->json('game');
        $this->assertSame(['Synthetic Host','Synthetic Guest','Third'], array_column($game['round']['answers'], 'name'));
    }

    public function test_blank_answers_and_late_joiners(): void
    {
        $this->start();
        $this->requestAs($this->host, 'show')->assertOk();
        $late = ['kind' => 'guest', 'name' => 'Late'];
        $this->requestAs($late, 'join', ['host'=>false])->assertOk()->assertJsonPath('game.round.eligible', true);
        $this->answer($late, '0e+0', '')->assertOk();
        $this->requestAs($this->host, 'close')->assertOk();
        $this->finishDisconnectedClose();
        $tooLate = ['kind'=>'guest', 'name'=>'Next round'];
        $this->requestAs($tooLate, 'join', ['host'=>false])->assertOk()->assertJsonPath('game.round.eligible', false);
        $this->requestAs($this->host, 'reveal')->assertOk()->assertJsonCount(0, 'game.round.answers')->assertJsonPath('game.players.3.score', 0);
        $this->requestAs($this->host, 'next')->assertOk();
        $this->requestAs($this->host, 'show')->assertOk();
        $this->requestAs($tooLate)->assertOk()->assertJsonPath('game.round.eligible', true);
    }

    public function test_blank_and_whitespace_are_excluded_but_explicit_zero_is_scored(): void
    {
        $answers = [
            ['raw' => '', 'value' => '0e+0'],
            ['raw' => " \t\n　", 'value' => '0e+0'],
            ['raw' => null, 'value' => '0e+0'],
            ['raw' => '０', 'value' => '0e+0'],
            ['raw' => '-2', 'value' => '-2e+0'],
        ];
        $scored = MedianNumbers::score($answers);
        $this->assertSame(['０', '-2'], array_column($scored, 'raw'));
        $this->assertSame([2, -1], array_column($scored, 'points'));
        $this->assertSame([], MedianNumbers::score(array_slice($answers, 0, 3)));
        $this->start();
        $this->requestAs($this->host, 'show')->assertOk();
        $this->answer($this->host, '0e+0', '0')->assertOk();
        $this->answer($this->guest, '0e+0', '　 ')->assertOk();
        $this->requestAs($this->host, 'close')->assertOk();
        $this->finishDisconnectedClose();
        $game = $this->requestAs($this->host, 'reveal')->assertOk()->json('game');
        $this->assertCount(1, $game['round']['answers']);
        $this->assertSame([2, 0], array_column($game['players'], 'score'));
    }

    public function test_same_name_guest_reentry_and_same_name_distinct_users(): void
    {
        $this->start();
        $this->requestAs($this->host, 'show');
        $this->answer($this->guest, '2e+0');
        $this->requestAs($this->host, 'close');
        $this->finishDisconnectedClose();
        $this->requestAs($this->host, 'reveal');
        $id = $this->requestAs($this->guest, 'leave')->assertOk()->json('game.players.1.id');
        $this->requestAs($this->guest, 'join', ['host'=>false])->assertOk()->assertJsonPath('game.me', $id)->assertJsonPath('game.players.1.score', 2);
        foreach (['account-a', 'account-b'] as $user) $this->requestAs(['kind'=>'user','userId'=>$user,'name'=>'Synthetic Guest'], 'join', ['host'=>false])->assertOk();
        $this->requestAs(['kind'=>'guest','name'=>' Synthetic Guest '], 'join', ['host'=>false])->assertOk()->assertJsonCount(5, 'game.players');
        $this->requestAs($this->guest, 'join', ['host'=>true])->assertStatus(409);
        $this->requestAs($this->host, 'leave')->assertStatus(422);
    }

    public function test_queue_revision_and_receive_do_not_duplicate_or_disclose(): void
    {
        $this->start();
        $this->requestAs($this->guest, 'queue', ['text'=>'bad','queueVersion'=>1])->assertForbidden();
        $this->requestAs($this->guest, 'suggest', ['text'=>'Suggested prompt'])->assertOk();
        $this->requestAs($this->host)->assertJsonPath('game.inboxCount', 1);
        $this->requestAs($this->host, 'receive')->assertOk()->assertJsonCount(3, 'game.queue')->assertJsonPath('game.queue.2', 'Suggested prompt（出題: Synthetic Guest）');
        $this->requestAs($this->host, 'receive')->assertOk()->assertJsonCount(3, 'game.queue');
        $this->requestAs($this->host, 'queue', ['text'=>'stale','queueVersion'=>1])->assertStatus(409);
    }

    public function test_explicit_end_retains_for_24_hours_and_restart_carries_queue_and_resets_scores(): void
    {
        $this->start();
        $this->requestAs($this->host, 'show');
        $this->requestAs($this->host, 'close');
        $this->finishDisconnectedClose();
        $this->requestAs($this->host, 'reveal');
        $this->requestAs($this->guest, 'suggest', ['text'=>'Still in inbox']);
        $this->travel(2)->days();
        $this->requestAs($this->host)->assertOk()->assertJsonPath('game.ended', false);
        $this->requestAs($this->host, 'end')->assertOk()->assertJsonPath('game.ended', true);
        $this->requestAs($this->guest, 'suggest', ['text'=>'No'])->assertStatus(409);
        $this->travel(23)->hours();
        $this->requestAs($this->host)->assertOk()->assertJsonPath('game.id', $this->gameId);
        $old = $this->gameId;
        $restarted = $this->requestAs($this->host, 'restart')->assertOk()->json('game');
        $this->assertNotSame($old, $restarted['id']);
        $this->assertSame([0,0], array_column($restarted['players'], 'score'));
        $this->assertSame(['Second prompt'], $restarted['queue']);
        $this->assertSame(1, $restarted['inboxCount']);
        $this->assertCount(0, $restarted['history']);
        $this->gameId = $restarted['id'];
        $this->requestAs($this->host, 'end')->assertOk();
        $this->travel(24)->hours();
        $this->artisan('median:prune')->assertSuccessful();
        $this->assertDatabaseCount('median_games', 0);
        $this->requestAs($this->host)->assertOk()->assertJsonPath('game', null);
    }

    public function test_unsigned_direct_and_generic_proxy_requests_cannot_change_game(): void
    {
        $this->postJson('/api/median', ['action'=>'join','host'=>true])->assertUnauthorized();
        $this->getJson('/api/median')->assertUnauthorized();
        $this->assertDatabaseCount('median_games', 0);
    }
}
