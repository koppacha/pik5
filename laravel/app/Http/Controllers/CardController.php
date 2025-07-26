<?php
namespace App\Http\Controllers;

use App\Models\Deck;
use App\Models\Player;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class CardController extends Controller
{
    // 山札からドロー
    public function draw(Request $request)
    {
        $playerName = $request['userId'];
        $player = Player::where('name', $playerName)->first();
        $pts = $player->draw_points;
        // ドローポイントを消費
        $player->draw_points = 0;
        $player->save();
        // ランダムにカード取得
        $cards = Deck::inRandomOrder()->limit($pts)->get();
        // 各カードの state をプレイヤー名に設定
        foreach ($cards as $card) {
            $card->state = $playerName;
            $card->save();
        }
        return $cards;
    }

    // 自分の手札取得
    public function hand(Request $request)
    {
        $playerName = $request['userId'];
        return Deck::where('state', $playerName)->get();
    }

    // フィールド上のカード取得
    public function fieldCards()
    {
        return Deck::where('state', '_field')->get();
    }

    // テイク
    public function take(Request $request, $id): Response
    {
        $playerName = $request['userId'];
        // 手札のうち選択されていないカードをスタックに移動
        Deck::where('state', $playerName)
            ->where('id', '!=', $id)
            ->update(['state' => '_stack']);
        // 選択されたカードをフィールドに移動
        Deck::where('id', $id)
            ->update(['state' => '_field']);
        return response()->noContent();
    }
}
