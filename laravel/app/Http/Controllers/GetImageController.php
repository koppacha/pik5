<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class GetImageController extends Controller
{
    public function show(Request $request): BinaryFileResponse
    {
        return response()->file(Storage::path("public/img/".$request["file"]));
    }
}

