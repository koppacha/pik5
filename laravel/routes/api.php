<?php

use App\Http\Controllers\ArenaController;
use App\Http\Controllers\BattleController;
use App\Http\Controllers\CardController;
use App\Http\Controllers\GetImageController;
use App\Http\Controllers\KeywordController;
use App\Http\Controllers\NewRecordController;
use App\Http\Controllers\PlayerController;
use App\Http\Controllers\PostCountController;
use App\Http\Controllers\RecordController;
use App\Http\Controllers\ScoreController;
use App\Http\Controllers\StageController;
use App\Http\Controllers\TotalController;
use App\Http\Controllers\TournamentController;
use App\Http\Controllers\UserNameController;
use App\Http\Controllers\UserTotalController;
use App\Http\Controllers\VoteController;
use App\Library\Func;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

Route::middleware(['auth:sanctum'])->get('/user', function (Request $request) {
    return $request->user();
});

// 汎用API
Route::group ([ 'middleware' => [ 'api', 'cors' ]], static function () {
    Route::get('func/member', [Func::class, 'memberCount']);
});

// 記録取得API
Route::group ([ 'middleware' => [ 'api', 'cors' ]], static function () {
    Route::get ( 'record' , [ RecordController::class, 'index' ]);
    Route::get ( 'record/rank/{stage}/{rule}/{score?}' , [ RecordController::class, 'getRank' ]);
    Route::get ('record/id/{id}', [RecordController::class, 'getRecord']);
    Route::get ( 'record/history/{stage_id}/{rule}/{user_id}' , [ RecordController::class, 'getRecordHistory' ]);
    Route::get ( 'record/{id}/{console?}/{rule?}/{year?}/{compare?}' , [ RecordController::class, 'show' ]);
    Route::post ( 'record' , [ RecordController::class, 'create' ]);
    Route::patch ( 'record/{id}' , [ RecordController::class, 'update' ]);
    Route::delete ( 'record/{id}' , [ RecordController::class, 'destroy' ]);
});

// 新着記録取得API
Route::group ([ 'middleware' => [ 'api', 'cors' ]], static function () {
    Route::get ( 'new' , [ NewRecordController::class, 'get' ]);
});

// 記録数カウントAPI
Route::group ([ 'middleware' => [ 'api', 'cors' ]], static function () {
    Route::get ( 'count' , [ PostCountController::class, 'getUserPostCount']);
    Route::get ( 'trend' , [ PostCountController::class, 'getTrendPostCount']);
    Route::get ( 'prev' , [ PostCountController::class, 'getPrevTrendPost']);
    Route::get ( 'count/{id}' , [ PostCountController::class, 'getUserAllPostCount']);
});

// 通常総合ランキング取得API
Route::group ([ 'middleware' => [ 'api', 'cors' ]], static function () {
    Route::get ( 'total/{id}/{console?}/{rule?}/{year?}' , [ TotalController::class, 'show' ]);
    Route::get ( 'stages/{series}' , [ TotalController::class, 'stage_list' ]);
});

// ステージ情報取得API
Route::group ([ 'middleware' => [ 'api', 'cors' ]], static function () {
    Route::get ( 'stage/all' , [ StageController::class, 'index' ]);
    Route::get ( 'stage/member' , [ StageController::class, 'allStageMember']);
    Route::get ( 'stage/max' , [ StageController::class, 'maxMember']);
    Route::get ( 'stage/{id}' , [ StageController::class, 'show' ]);
});

// ユーザーIDからユーザー名を取得する
Route::group ([ 'middleware' => [ 'api', 'cors' ]], static function () {
    Route::get('user/name/{id}', [UserNameController::class, 'requestName']);
});

// ユーザーIDから全順位を取得する
Route::group ([ 'middleware' => [ 'api', 'cors' ]], static function () {
    Route::get('user/total/{id}', [UserTotalController::class, 'show'])->name('user.total');
    Route::get('user/rank/{id}', [UserTotalController::class, 'getTotalsTables']);
});

// キーワード関連API
Route::group ([ 'middleware' => [ 'api', 'cors']], static function () {
    Route::get ( 'keyword' , [ KeywordController::class, 'index' ]);
    Route::get ( 'keyword/{id}' , [ KeywordController::class, 'show' ]);
    Route::post ( 'keyword' , [ KeywordController::class, 'create' ]);
    Route::patch ( 'keyword/{id}' , [ KeywordController::class, 'update' ]);
    Route::delete ( 'keyword/{id}' , [ KeywordController::class, 'destroy' ]);
});

// 投票関連API
Route::group ([ 'middleware' => [ 'api', 'cors']], static function () {
    Route::get ( 'vote/{vote}' , [ VoteController::class, 'show' ]);
    Route::get ( 'vote' , [ VoteController::class, 'index' ]);
    Route::post ( 'vote' , [ VoteController::class, 'create' ]);
});

// 証拠画像取得API
Route::group ([ 'middleware' => [ 'api' ]], static function () {
    Route:: get('img/{file}', [GetImageController::class, 'show']);
});

// アリーナ情報取得API
Route::group ([ 'middleware' => [ 'api' ]], static function () {
    Route:: get('arena', [ArenaController::class, 'index']);
    Route:: get('arena/update/{team}/{stage?}/{time?}', [ArenaController::class, 'update']);
});
// バトル大会記録用API
Route::group ([ 'middleware' => [ 'api' ]], static function () {
    Route:: post('battle', [BattleController::class, 'create']);
    Route:: get('battle/rate', [BattleController::class, 'getRate']);
    Route:: get('battle/score', [BattleController::class, 'getScore']);
});
// テスト用
Route::group ([ 'middleware' => [ 'api' ]], static function () {
    Route:: get('max', [Func::class, 'memberCount']);
    Route:: get('simulate', [Func::class, 'simulate_rank_point_calc']);
//    Route:: get('/phpinfo', static function (){
//        phpinfo();
//    });
});
// 第19回期間限定
// Route::middleware('auth:api')->group(function () {
Route::group ([ 'middleware' => [ 'api' ]], static function () {
    Route::get('players', [PlayerController::class, 'index']);
    Route::get('players/me', [PlayerController::class ,'me']);
    Route::post('join', [PlayerController::class, 'join']);

    Route::post('draw', [CardController::class, 'draw']);
    Route::get('hand', [CardController::class, 'hand']);
    Route::get('field-cards', [CardController::class, 'fieldCards']);
    Route::post('cards/{id}/take', [CardController::class, 'take']);

    Route::get('cards/{id}/scores', [ScoreController::class, 'index']);
    Route::post('cards/{id}/scores', [ScoreController::class, 'store']);

    Route::get('tournament', [TournamentController::class, 'info']);
});

