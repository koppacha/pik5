<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class UserNameController extends Controller
{
    // GETリクエストからIDを取得して名前に変換
    public function requestName(Request $request): JsonResponse
    {
        $data = User::select('user_name')->where('user_id', $request['id'])->get();
        return response()->json(
            $data
        );
    }
    // その他のコントローラーからIDを取得して名前に変換
    public static function getName($request)
    {
        return User::select('user_name')->where('user_id', $request)->first(["user_name"]);
    }
}
