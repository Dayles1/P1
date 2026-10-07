<?php

namespace App\Games\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Base for every games API controller: the same `{success, message, data}`
 * envelope the rest of the API answers with, without depending on the main
 * application's controllers.
 */
abstract class GameController
{
    protected function success(mixed $data = null, string $message = '', int $status = 200): JsonResponse
    {
        return response()->json(['success' => true, 'message' => $message, 'data' => $data], $status);
    }

    protected function error(string $message, int $status = 400, mixed $data = null): JsonResponse
    {
        return response()->json(['success' => false, 'message' => $message, 'data' => $data], $status);
    }

    /**
     * The player: the main application's user id — the one thing games
     * share with it.
     */
    protected function playerId(Request $request): int
    {
        return (int) $request->user()->getAuthIdentifier();
    }
}
