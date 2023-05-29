<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

return response()->file(Storage::path("uploads/sample.jpg"));
