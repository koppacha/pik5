<?php

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
Route :: group ([ 'middleware' => [ 'api' ]], static  function () {
    Route :: get ( 'record' , [ RecordController ::class, 'index' ]);
    Route :: get ( 'record/{id}/{console?}/{rule?}/{year?}/{compare?}' , [ RecordController ::class, 'show' ]);
    Route :: post ( 'record' , [ RecordController ::class, 'create' ]);
    Route :: patch ( 'record/{id}' , [ RecordController ::class, 'update' ]);
    Route :: delete ( 'record/{id}' , [ RecordController ::class, 'destroy' ]);
});

// 通常総合ランキング取得API
Route :: group ([ 'middleware' => [ 'api' ]], static  function () {
    Route :: get ( 'total/{id}/{console?}/{rule?}/{year?}' , [ TotalController ::class, 'show' ]);
    Route :: post ( 'total' , [ TotalController ::class, 'create' ]);
});

// ステージ情報取得API
Route :: group ([ 'middleware' => [ 'api' ]], static  function () {
    Route :: get ( 'stage/{id}' , [ StageController ::class, 'show' ]);
});

// ユーザーIDからユーザー名を取得する
Route :: group ([ 'middleware' => [ 'api' ]], static  function () {
    Route:: get('user/name/{id}', [UserNameController ::class, 'requestName']);
});
