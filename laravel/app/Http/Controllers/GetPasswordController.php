<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class GetPasswordController extends Controller
{
    public function show(): JsonResponse
    {
        $passes = [];
        $password = [];
        foreach($passes as $pass) {
            $method = "aes-256-ecb";
            $rand = "reuhg9regehrougherupgherpugherpguhp";
            $password[] = openssl_decrypt($pass, $method, $rand);
        }
        return response()->json(
            $password
        );
    }
}

