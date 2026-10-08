<?php

namespace App\Games\Sandbox\Http\Controllers;

use App\Games\Sandbox\Models\Player;
use App\Games\Sandbox\Score;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * What the games hub shows about the Sandbox: the leaderboard (the best
 * twenty scores and the player's own place) and a one-line summary of the
 * player's progress for the game's card. Answers in the same shape as the
 * hub's other games, so the hub draws them alike.
 */
class LeaderboardController
{
    private const int SIZE = 20;

    public function index(Request $request): JsonResponse
    {
        $playerId = $this->playerId($request);
        $query = fn () => Player::query()->select(['id', 'user_id', 'score', 'stats', 'harvested', 'updated_at']);

        $top = $query()
            ->orderByDesc('score')
            ->orderBy('updated_at')
            ->orderBy('id')
            ->limit(self::SIZE)
            ->get();

        $mine = $query()->where('user_id', $playerId)->first();
        $names = $this->names(
            $top->map(fn (Player $player): int => $player->user_id)->push($playerId)->values()->all(),
        );

        $entries = [];
        $rank = 0;
        $previousScore = null;

        foreach ($top->values() as $position => $player) {
            if ($player->score !== $previousScore) {
                $rank = $position + 1;
                $previousScore = $player->score;
            }

            $entries[] = [
                'rank' => $rank,
                'name' => $names[$player->user_id] ?? null,
                'score' => $player->score,
                'details' => $this->details($player),
                'is_me' => $player->user_id === $playerId,
            ];
        }

        return $this->success([
            'game' => 'sandbox',
            'entries' => $entries,
            'me' => $mine === null ? null : [
                'rank' => Player::query()->where('score', '>', $mine->score)->count() + 1,
                'name' => $names[$playerId] ?? null,
                'score' => $mine->score,
                'details' => $this->details($mine),
            ],
        ]);
    }

    /**
     * The player's progress for the hub's card; null before they ever played.
     */
    public function summary(Request $request): JsonResponse
    {
        $player = Player::query()->where('user_id', $this->playerId($request))->first();

        return $this->success($player === null ? null : [
            'score' => $player->score,
            ...$this->details($player),
            'played_at' => $player->updated_at?->toIso8601String(),
        ]);
    }

    /**
     * @return array{kills: int, trees: int, artifacts: int}
     */
    private function details(Player $player): array
    {
        $stats = $player->stats ?? [];

        return [
            'kills' => Score::kills($stats),
            'trees' => max(0, (int) ($stats['trees'] ?? 0)),
            'artifacts' => Score::found($stats, $player->harvested ?? []),
        ];
    }

    /**
     * Display names from the host application's users — through whatever
     * model its auth uses, so the game does not depend on the host's code.
     * A missing name stays null; the hub shows a stand-in.
     *
     * @param  array<int, int>  $userIds
     * @return array<int, string>
     */
    private function names(array $userIds): array
    {
        /** @var class-string<Model> $users */
        $users = config('auth.providers.users.model');

        return $users::query()
            ->whereIn('id', array_unique($userIds))
            ->pluck('name', 'id')
            ->filter(fn (mixed $name): bool => filled($name))
            ->map(fn (mixed $name): string => (string) $name)
            ->all();
    }

    private function success(mixed $data = null): JsonResponse
    {
        return response()->json(['success' => true, 'message' => '', 'data' => $data]);
    }

    private function playerId(Request $request): int
    {
        return (int) $request->user()->getAuthIdentifier();
    }
}
