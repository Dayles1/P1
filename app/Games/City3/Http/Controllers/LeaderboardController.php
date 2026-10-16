<?php

namespace App\Games\City3\Http\Controllers;

use App\Games\City3\ContentRepository;
use App\Games\City3\Models\World;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * What the games hub shows about "Летопись города 3": the leaderboard (the
 * best twenty worlds by score and the player's own place) and a one-line
 * summary of the player's progress for the game's card. Answers in the
 * same shape as the hub's other games, so the hub draws them alike. Ties
 * share a rank (1, 2, 2, 4); among them whoever got there first is listed
 * first.
 */
class LeaderboardController
{
    private const int SIZE = 20;

    public function __construct(private ContentRepository $content) {}

    public function index(Request $request): JsonResponse
    {
        $playerId = $this->playerId($request);

        $top = $this->worlds()
            ->orderByDesc('score')
            ->orderBy('updated_at')
            ->orderBy('id')
            ->limit(self::SIZE)
            ->get();

        $mine = $this->worlds()->where('user_id', $playerId)->first();
        $names = $this->names(
            $top->map(fn (World $world): int => $world->user_id)->push($playerId)->values()->all(),
        );

        $entries = [];
        $rank = 0;
        $previousScore = null;

        foreach ($top->values() as $position => $world) {
            if ($world->score !== $previousScore) {
                $rank = $position + 1;
                $previousScore = $world->score;
            }

            $entries[] = [
                'rank' => $rank,
                'name' => $names[$world->user_id] ?? null,
                'score' => $world->score,
                'details' => $this->details($world),
                'is_me' => $world->user_id === $playerId,
            ];
        }

        return $this->success([
            'game' => 'city3',
            'entries' => $entries,
            'me' => $mine === null ? null : [
                'rank' => World::query()->where('score', '>', $mine->score)->count() + 1,
                'name' => $names[$playerId] ?? null,
                'score' => $mine->score,
                'details' => $this->details($mine),
            ],
        ]);
    }

    /**
     * The player's progress for the hub's card; null before they founded a
     * world.
     */
    public function summary(Request $request): JsonResponse
    {
        $world = $this->worlds()->where('user_id', $this->playerId($request))->first();

        return $this->success($world === null ? null : [
            ...$this->details($world),
            'score' => $world->score,
            'played_at' => $world->updated_at?->toIso8601String(),
        ]);
    }

    /**
     * Worlds with the columns the leaderboard and the card read.
     *
     * @return Builder<World>
     */
    private function worlds(): Builder
    {
        return World::query()->select(['id', 'user_id', 'score', 'epoch', 'year', 'population', 'updated_at']);
    }

    /**
     * What is shown next to the score: how far the player's city has come.
     *
     * @return array{epoch: string, epoch_name: string|null, year: int, population: int}
     */
    private function details(World $world): array
    {
        return [
            'epoch' => $world->epoch,
            'epoch_name' => $this->content->epochName($world->epoch),
            'year' => $world->year,
            'population' => $world->population,
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

    /**
     * The player: the host application's user id — the one thing the game
     * shares with it.
     */
    private function playerId(Request $request): int
    {
        return (int) $request->user()->getAuthIdentifier();
    }
}
