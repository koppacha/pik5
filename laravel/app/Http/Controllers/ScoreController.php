<?php
namespace App\Http\Controllers;

use App\Models\Score;
use Illuminate\Http\Request;

class ScoreController extends Controller
{
    // カードごとのスコア一覧
    public function index($id)
    {
        return Score::where('card_id', $id)->orderBy('score', 'desc')->get();
    }

    // スコア登録
    public function store(Request $request, $id)
    {
        $data = $request->validate(['score' => 'required|integer']);
        $data['card_id'] = $id;
        $data['player_id'] = $request->user()->id;
        return Score::updateOrCreate(
            ['card_id' => $id, 'player_id' => $request->user()->id],
            $data
        );
    }
}
