<?php

namespace App\Games\Sandbox\Http\Controllers;

use App\Games\Sandbox\Http\Requests\SavePlayerRequest;
use App\Games\Sandbox\Models\Player;
use App\Games\Sandbox\Score;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Loads, saves and resets the player's character: the hero (class,
 * gender, level), where it stands, its health, mana, inventory and
 * armour, what it has used up, the campfires and buildings it has put
 * down, its statistics and what it has learnt. Answers with the same
 * `{success, message, data}` envelope as the host API, without
 * depending on its controllers.
 */
class PlayerController
{
    public function show(Request $request): JsonResponse
    {
        $player = Player::query()->where('user_id', $this->playerId($request))->first();

        return $this->success($player === null ? null : $this->present($player));
    }

    public function update(SavePlayerRequest $request): JsonResponse
    {
        $player = Player::query()->updateOrCreate(
            ['user_id' => $this->playerId($request)],
            $request->player(),
        );

        // Worked out here, from what was saved, never taken from the browser.
        $player->score = Score::of($player->stats ?? [], $player->harvested ?? []);
        $player->save();

        return $this->success($this->present($player));
    }

    public function destroy(Request $request): JsonResponse
    {
        Player::query()->where('user_id', $this->playerId($request))->delete();

        return $this->success();
    }

    /**
     * @return array{hero: array<string, mixed>|null, x: float, y: float, z: float, yaw: float, health: float|null, mana: float|null, inventory: list<array{item: string, count: int, wear?: int}|null>, equipment: array<string, array{item: string, count: int, wear?: int}|null>, harvested: list<array{id: string, at: int}>, placed: list<array<string, mixed>>, stats: array<string, int>, research: array{points: int, known: list<string>}|null, saved_at: string|null}
     */
    private function present(Player $player): array
    {
        return [
            'hero' => $player->hero,
            'x' => $player->x,
            'y' => $player->y,
            'z' => $player->z,
            'yaw' => $player->yaw,
            'health' => $player->health,
            'mana' => $player->mana,
            'inventory' => $player->inventory ?? [],
            'equipment' => $player->equipment ?? ['head' => null, 'body' => null, 'feet' => null],
            'harvested' => $player->harvested ?? [],
            'placed' => $player->placed ?? [],
            'stats' => $player->stats ?? [],
            'research' => $player->research,
            'saved_at' => $player->updated_at?->toIso8601String(),
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
