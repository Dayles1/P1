<?php

namespace App\Games\Community\Http\Controllers;

use App\Games\Community\Http\Requests\RateGameRequest;
use App\Games\Community\Models\GamePlaytime;
use App\Games\Community\Models\GameRating;
use App\Games\Community\RatingSummary;
use App\Games\Game;
use App\Games\Http\Controllers\GameController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Players' ratings of the games: the summary the Games menu shows, and the
 * player's own rating — given only after a few minutes of actual play.
 */
class RatingController extends GameController
{
    public function __construct(private RatingSummary $summary) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success($this->summary->forPlayer($this->playerId($request)));
    }

    public function update(RateGameRequest $request, Game $game): JsonResponse
    {
        $playerId = $this->playerId($request);

        $seconds = (int) GamePlaytime::query()
            ->where('user_id', $playerId)
            ->where('game', $game)
            ->value('seconds');

        if ($seconds < Game::SECONDS_TO_RATE) {
            return $this->error(__('games::messages.rating_too_early'), 403);
        }

        $data = $request->validated();
        $comment = trim((string) ($data['comment'] ?? ''));

        GameRating::query()->updateOrCreate(
            ['user_id' => $playerId, 'game' => $game],
            ['stars' => $data['stars'], 'comment' => $comment === '' ? null : $comment],
        );

        return $this->success($this->summary->forPlayer($playerId)[$game->value]);
    }

    public function destroy(Request $request, Game $game): JsonResponse
    {
        $playerId = $this->playerId($request);

        GameRating::query()->where('user_id', $playerId)->where('game', $game)->delete();

        return $this->success($this->summary->forPlayer($playerId)[$game->value]);
    }
}
