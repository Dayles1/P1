<?php

namespace App\Games\GuWorld\Http\Controllers;

use App\Games\GuWorld\Models\Save;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The player's saved game. Answers with the same `{success, message,
 * data}` envelope as the host API, without depending on its controllers.
 * No save yet means a new game: the client starts one (on the first
 * morning).
 */
class SaveController
{
    public function show(Request $request): JsonResponse
    {
        $save = Save::query()->where('user_id', $this->playerId($request))->first();

        return $this->success($save === null ? null : $this->present($save));
    }

    /**
     * @return array{version: int, location: string, world_minutes: float, player: array{x: float, y: float, z: float, yaw: float}, saved_at: string|null}
     */
    private function present(Save $save): array
    {
        return [
            'version' => $save->version,
            'location' => $save->location,
            'world_minutes' => $save->world_minutes,
            'player' => $save->player,
            'saved_at' => $save->updated_at?->toIso8601String(),
        ];
    }

    private function success(mixed $data = null): JsonResponse
    {
        return response()->json(['success' => true, 'message' => '', 'data' => $data]);
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
