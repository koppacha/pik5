<?php
namespace App\Http\Controllers;

use App\Models\Player;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;

class PlayerController extends Controller
{
    // 全プレイヤー取得
    public function index(): Collection
    {
        return Player::all();
    }

    // 自分の情報
    public function me(Request $request)
    {
        return Player::where('name', $request["userId"])->first();
    }

    // 参加
    public function join(Request $request)
    {
        return Player::create([
            'id' => 1,
            'name' => $request["userId"],
        ]);
    }
}
