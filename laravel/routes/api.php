<?php

use App\Http\Controllers\GetImageController;
use App\Http\Controllers\KeywordController;
use App\Http\Controllers\NewRecordController;
use App\Http\Controllers\PostCountController;
use App\Http\Controllers\UserTotalController;
use App\Http\Controllers\RecordController;
use App\Http\Controllers\StageController;
use App\Http\Controllers\TotalController;
use App\Http\Controllers\UserNameController;
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

// 記録取得API
Route :: group ([ 'middleware' => [ 'api', 'cors' ]], static function () {
    Route :: get ( 'record' , [ RecordController ::class, 'index' ]);
    Route :: get ( 'record/{id}/{console?}/{rule?}/{year?}/{compare?}' , [ RecordController ::class, 'show' ]);
    Route :: post ( 'record' , [ RecordController ::class, 'create' ]);
    Route :: patch ( 'record/{id}' , [ RecordController ::class, 'update' ]);
    Route :: delete ( 'record/{id}' , [ RecordController ::class, 'destroy' ]);
});

// 新着記録取得API
Route :: group ([ 'middleware' => [ 'api', 'cors' ]], static function () {
    Route :: get ( 'new' , [ NewRecordController ::class, 'get' ]);
});

// 記録数カウントAPI
Route :: group ([ 'middleware' => [ 'api', 'cors' ]], static function () {
    Route :: get ( 'count' , [ PostCountController ::class, 'getUserPostCount']);
    Route :: get ( 'trend' , [ PostCountController ::class, 'getTrendPostCount']);
});

// 通常総合ランキング取得API
Route :: group ([ 'middleware' => [ 'api', 'cors' ]], static function () {
    Route :: get ( 'total/{id}/{console?}/{rule?}/{year?}' , [ TotalController ::class, 'show' ]);
    Route :: post ( 'total' , [ TotalController ::class, 'create' ]);
});

// ステージ情報取得API
Route :: group ([ 'middleware' => [ 'api', 'cors' ]], static function () {
    Route :: get ( 'stage/{id}' , [ StageController ::class, 'show' ]);
});

// ユーザーIDからユーザー名を取得する
Route :: group ([ 'middleware' => [ 'api', 'cors' ]], static function () {
    Route:: get('user/name/{id}', [UserNameController ::class, 'requestName']);
});

// ユーザーIDから全順位を取得する
Route :: group ([ 'middleware' => [ 'api', 'cors' ]], static function () {
    Route:: get('user/total/{id}', [UserTotalController ::class, 'show']);
});

// キーワード関連Wiki
Route :: group ([ 'middleware' => [ 'api', 'cors']], static function () {
    Route :: get ( 'keyword' , [ KeywordController ::class, 'index' ]);
    Route :: get ( 'keyword/{id}' , [ KeywordController ::class, 'show' ]);
    Route :: post ( 'keyword' , [ KeywordController ::class, 'create' ]);
    Route :: patch ( 'keyword/{id}' , [ KeywordController ::class, 'update' ]);
    Route :: delete ( 'keyword/{id}' , [ KeywordController ::class, 'destroy' ]);
});

// 証拠画像取得API
Route :: group ([ 'middleware' => [ 'api' ]], static function () {
    Route:: get('img/{file}', [GetImageController ::class, 'show']);
});
