<?php

namespace App\Games\CityBuilder\Http\Controllers;

use App\Games\CityBuilder\Http\Requests\SaveCityRequest;
use App\Games\CityBuilder\Models\CitySave;
use App\Games\Http\Controllers\GameController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Loads, saves and resets the player's city. The game itself runs in the
 * browser; the server keeps one save per player.
 */
class CitySaveController extends GameController
{
    public function show(Request $request): JsonResponse
    {
        $save = CitySave::query()->where('user_id', $this->playerId($request))->first();

        return $this->success($save === null ? null : $this->present($save));
    }

    public function update(SaveCityRequest $request): JsonResponse
    {
        $playerId = $this->playerId($request);
        $data = $request->validated();

        return DB::connection(config('games.connection'))->transaction(function () use ($playerId, $data): JsonResponse {
            $save = CitySave::query()->where('user_id', $playerId)->lockForUpdate()->first();

            if ($save !== null && $data['revision'] !== $save->revision) {
                return $this->error(__('games::messages.save_conflict'), 409, $this->present($save));
            }

            $save ??= new CitySave(['user_id' => $playerId, 'revision' => 0]);

            $save->fill([
                'revision' => $save->revision + 1,
                'epoch' => $data['epoch'],
                'year' => $data['year'],
                'population' => $data['population'],
                'score' => $data['score'],
                'state' => $data['state'],
            ])->save();

            return $this->success(['revision' => $save->revision, 'saved_at' => $save->updated_at?->toIso8601String()]);
        });
    }

    public function destroy(Request $request): JsonResponse
    {
        CitySave::query()->where('user_id', $this->playerId($request))->delete();

        return $this->success();
    }

    /**
     * @return array{revision: int, state: array<string, mixed>, saved_at: string|null}
     */
    private function present(CitySave $save): array
    {
        return [
            'revision' => $save->revision,
            'state' => $save->state,
            'saved_at' => $save->updated_at?->toIso8601String(),
        ];
    }
}
