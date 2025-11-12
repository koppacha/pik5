<?php
namespace App\Http\Controllers;

class TournamentController extends Controller
{
    public function info(): array
    {
        return [
            'start' => '2025-07-01T00:00:00+09:00',
            'end'   => '2025-11-30T00:00:00+09:00',
            ];
    }
}
