<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

class GetImageController extends Controller
{
    public function show(Request $request): BinaryFileResponse
    {
        return response()->file(Storage::path("public/img/".$request["file"]));
    }
    public function showAny(Request $request): Response
    {
        $path = $request->route('path'); // 階層含む
        $file = $request->route('file');

        // 1) ざっくりサニタイズ（ディレクトリトラバーサル対策）
        if (str_contains($path, '..') || str_contains($file, '..')) {
            return response()->json(['message' => 'Invalid path'], 400);
        }

        // 2) 許可する文字だけに限定（必要に応じて拡張）
        if (!preg_match('/^[A-Za-z0-9_\\-\\/]+$/', $path) || !preg_match('/^[A-Za-z0-9_\\-\\.]+$/', $file)) {
            return response()->json(['message' => 'Invalid characters'], 400);
        }

        // 3) public ディスク上のフルパスを組み立て
        $storageRelative = "public/{$path}/{$file}";
        if (!Storage::exists($storageRelative)) {
            return response()->json(['message' => 'Not Found'], 404);
        }

        $fullPath = Storage::path($storageRelative);
        return response()->file($fullPath);
    }
}

