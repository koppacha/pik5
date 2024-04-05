<?php

namespace App\Http\Controllers;

use App\Models\Arena;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ArenaController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        // 有効なレコードをすべて返す
        return response()->json(Arena::where('del', 0)->get());
    }

    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     *
     * @param  \App\Models\Arena  $arena
     * @return \Illuminate\Http\Response
     */
    public function show(Arena $arena)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  \App\Models\Arena  $arena
     * @return \Illuminate\Http\Response
     */
    public function edit(Arena $arena)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \App\Models\Arena  $arena
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, Arena $arena)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  \App\Models\Arena  $arena
     * @return \Illuminate\Http\Response
     */
    public function destroy(Arena $arena)
    {
        //
    }
}
