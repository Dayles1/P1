<?php

namespace App\Games\Http\Controllers;

use App\Games\CityBuilder\Models\CitySave;
use App\Games\Epochs\Content\ContentRepository;
use App\Games\Epochs\Models\World;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameHubController extends GameController
{
    /**
     * The player's progress in each game they have started, keyed by the
     * game's slug — the Games menu turns "Play" into "Continue" with it.
     */
    public function progress(Request $request, ContentRepository $content): JsonResponse
    {
        $playerId = $this->playerId($request);

        $city = CitySave::query()
            ->where('user_id', $playerId)
            ->first(['epoch', 'year', 'population', 'score', 'updated_at']);

        $epochs = World::query()
            ->where('user_id', $playerId)
            ->first(['epoch', 'epoch_index', 'year', 'population', 'score', 'updated_at']);

        return $this->success([
            'city' => $city === null ? null : [
                'epoch' => $city->epoch,
                'year' => $city->year,
                'population' => $city->population,
                'score' => $city->score,
                'played_at' => $city->updated_at?->toIso8601String(),
            ],
            'epochs' => $epochs === null ? null : [
                'epoch' => $epochs->epoch,
                'epoch_index' => $epochs->epoch_index,
                'epoch_name' => collect($content->read('epochs')['epochs'] ?? [])->firstWhere('id', $epochs->epoch)['name'] ?? null,
                'year' => $epochs->year,
                'population' => $epochs->population,
                'score' => $epochs->score,
                'played_at' => $epochs->updated_at?->toIso8601String(),
            ],
        ]);
    }
}
