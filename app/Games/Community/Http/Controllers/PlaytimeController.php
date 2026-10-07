<?php

namespace App\Games\Community\Http\Controllers;

use App\Games\Community\Models\GamePlaytime;
use App\Games\Game;
use App\Games\Http\Controllers\GameController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Counts play time from the heartbeat the SPA sends once a minute while a
 * game is on screen. The server measures the time itself — the time since
 * the previous heartbeat, at most a minute, nothing after a long silence —
 * so the browser cannot make it grow faster than the clock.
 */
class PlaytimeController extends GameController
{
    public function store(Request $request, Game $game): JsonResponse
    {
        $playerId = $this->playerId($request);

        $playtime = DB::connection(config('games.connection'))->transaction(function () use ($playerId, $game): GamePlaytime {
            $now = now();

            $playtime = GamePlaytime::query()
                ->where('user_id', $playerId)
                ->where('game', $game)
                ->lockForUpdate()
                ->first();

            if ($playtime === null) {
                return GamePlaytime::query()->createOrFirst(
                    ['user_id' => $playerId, 'game' => $game],
                    ['seconds' => 0, 'last_ping_at' => $now],
                );
            }

            $gap = $playtime->last_ping_at === null ? null : (int) $playtime->last_ping_at->diffInSeconds($now, true);

            if ($gap !== null && $gap <= Game::HEARTBEAT_GAP_SECONDS) {
                $playtime->seconds += min(Game::HEARTBEAT_SECONDS, $gap);
            }

            $playtime->last_ping_at = $now;
            $playtime->save();

            return $playtime;
        });

        return $this->success([
            'seconds' => $playtime->seconds,
            'can_rate' => $playtime->seconds >= Game::SECONDS_TO_RATE,
        ]);
    }
}
