<?php

namespace App\Http\Controllers;

use App\Services\ManagementIdentity;
use App\Services\YearRecords;
use Illuminate\Http\Request;

class YearRecordController extends Controller
{
    public function show(string $year, YearRecords $records)
    {
        return response()->json($records->get(YearRecords::validateYear($year)))
            ->header('Cache-Control', 'private, no-store');
    }

    public function refresh(Request $request, string $year, ManagementIdentity $identity, YearRecords $records)
    {
        $year = YearRecords::validateYear($year);
        abort_unless($identity->resolve($request)['role'] === 10, 403);
        $records->forget($year);
        return response()->json(['refreshed' => true])->header('Cache-Control', 'private, no-store');
    }
}
