<?php

use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\RecordController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\LoginController;

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
//    return $request->user();
    Route::get('user',[UserController::class, 'index']);
});

Route::group(['middleware' => ['api']], static function () {
    Route::get('record', [RecordController::class, 'index']);
    Route::get('record/{id}', [RecordController::class, 'show']);
    Route::post('record', [RecordController::class, 'create']);
    Route::patch('record/{id}', [RecordController::class, 'update']);
    Route::delete('record/{id}', [RecordController::class, 'destroy']);

    Route::post('login',[LoginController::class, 'login']);
});
