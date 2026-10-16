<?php

namespace App\Games\City3\Http\Controllers;

use App\Games\City3\WorldStore;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Wipes the player's progress in the game — what the games hub's reset
 * button calls on a game with an API of its own. Today that progress is
 * the player's world and nothing else; nothing outside the game is
 * touched (play time and ratings stay with the hub).
 */
class PlayerController
{
    public function __construct(private WorldStore $worlds) {}

    public function destroy(Request $request): JsonResponse
    {
        $world = $this->worlds->find($this->playerId($request));

        if ($world !== null) {
            $this->worlds->delete($world);
        }

        return response()->json(['success' => true, 'message' => '', 'data' => null]);
    }

    /**
     * The player: the host application's user id — the one thing the game
     * shares with it.
     */
    private function playerId(Request $request): int
    {
        return (int) $request->user()->getAuthIdentifier();
    }
}
