<?php

namespace App\Http\Controllers;

use App\Models\Book;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BookController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return JsonResponse
     */
    public function index(): JsonResponse
    {
        $books = Book::all();
        return response()->json([
            'message' => 'ok',
            'data'    => $books,
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        $book = Book::create($request->all());
        return response()->json([
            'message' => 'Book created successfully',
            'data' => $book
        ], 201, [], JSON_UNESCAPED_UNICODE);
    }

    /**
     * Display the specified resource.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function show(int $id): JsonResponse
    {
        $book = Book::find($id);
        if ($book) {
            return response()->json([
                'message' => 'ok',
                'data' => $book
            ], 200, [], JSON_UNESCAPED_UNICODE);
        }
        return response()->json([
            'message' => 'Book not found',
        ], 404);
    }

    /**
     * Update the specified resource in storage.
     *
     * @param Request $request
     * @param int $id
     * @return JsonResponse
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $update = [
            'title' => $request->title,
            'author' => $request->author
        ];
        $book = Book::where('id', $id)->update($update);
        if ($book) {
            return response()->json([
                'message' => 'Book updated successfully',
            ], 200);
        }
        return response()->json([
            'message' => 'Book not fount',
        ], 404);
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param int $id
     * @return JsonResponse
     */
    public function destroy(int $id): JsonResponse
    {
        $book = Book::where('id', $id)->delete();
        if ($book) {
            return response()->json([
                'message' => 'Book deleted successfully',
            ], 200);
        }
        return response()->json([
            'message' => 'Book not found',
        ], 404);
    }
}
