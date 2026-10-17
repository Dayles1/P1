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
 * best twenty worlds and the player's own place) and a one-line summary of
 * the player's progress for the game's card. Answers in the same shape as
 * the hub's other games, so the hub draws them alike.
 *
 * Ranks use the score the server worked out (WorldStore), never the
 * browser's. Three tabs (gdd §10): `overall` by score; `chronicle` by
 * stars, then the lead at the last era entry; `era` by score among the
 * worlds in the player's era. Worlds kept off the board (tester tools,
 * implausible saves) are not ranked. Ties share a rank (1, 2, 2, 4); among
 * them whoever got there first is listed first.
 */
class LeaderboardController
{
    private const int SIZE = 20;

    /** The columns each tab ranks by, best first. */
    private const array ORDER = [
        'overall' => ['score'],
        'chronicle' => ['stars', 'lead', 'score'],
        'era' => ['score'],
    ];

    public function __construct(private ContentRepository $content) {}

    public function index(Request $request): JsonResponse
    {
        $playerId = $this->playerId($request);
        $tab = $this->tab($request);
        $mine = $this->worlds()->where('user_id', $playerId)->first();
        $keys = self::ORDER[$tab];

        $query = $this->board($tab, $mine);

        foreach ($keys as $key) {
            $query->orderByDesc($key);
        }

        $top = $query->orderBy('updated_at')->orderBy('id')->limit(self::SIZE)->get();

        $names = $this->names(
            $top->map(fn (World $world): int => $world->user_id)->push($playerId)->values()->all(),
        );

        $entries = [];
        $rank = 0;
        $previous = null;

        foreach ($top->values() as $position => $world) {
            $standing = $world->only($keys);

            if ($standing !== $previous) {
                $rank = $position + 1;
                $previous = $standing;
            }

            $entries[] = [
                'rank' => $rank,
                'name' => $names[$world->user_id] ?? null,
                'score' => $world->score,
                'details' => $this->standing($world),
                'is_me' => $world->user_id === $playerId,
            ];
        }

        return $this->success([
            'game' => 'city3',
            'tab' => $tab,
            'entries' => $entries,
            'me' => $mine === null ? null : [
                'rank' => $mine->ranked ? $this->rankOf($mine, $tab) : null,
                'name' => $names[$playerId] ?? null,
                'score' => $mine->score,
                'details' => $this->standing($mine),
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
        return World::query()->select([
            'id', 'user_id', 'score', 'epoch', 'year', 'population', 'stars', 'lead', 'ranked', 'updated_at',
        ]);
    }

    /**
     * The ranked worlds a tab lists: all of them, or those in the player's era.
     *
     * @return Builder<World>
     */
    private function board(string $tab, ?World $mine): Builder
    {
        $query = $this->worlds()->where('ranked', true);

        if ($tab === 'era' && $mine !== null) {
            $query->where('epoch', $mine->epoch);
        }

        return $query;
    }

    /**
     * The player's place on a tab: one more than the ranked worlds ahead.
     */
    private function rankOf(World $mine, string $tab): int
    {
        $keys = self::ORDER[$tab];

        $ahead = $this->board($tab, $mine)->where(function (Builder $query) use ($keys, $mine): void {
            foreach ($keys as $index => $key) {
                $query->orWhere(function (Builder $tie) use ($keys, $index, $key, $mine): void {
                    foreach (array_slice($keys, 0, $index) as $equal) {
                        $tie->where($equal, $mine->{$equal});
                    }

                    $tie->where($key, '>', $mine->{$key});
                });
            }
        })->count();

        return $ahead + 1;
    }

    private function tab(Request $request): string
    {
        $tab = $request->query('tab', 'overall');

        return is_string($tab) && isset(self::ORDER[$tab]) ? $tab : 'overall';
    }

    /**
     * A leaderboard row's details: how far the city has come and its
     * Chronicle (the stars and the lead at the last era entry).
     *
     * @return array{epoch: string, epoch_name: string|null, year: int, population: int, lead: int, stars: int}
     */
    private function standing(World $world): array
    {
        return [
            ...$this->details($world),
            'lead' => (int) $world->lead,
            'stars' => (int) $world->stars,
        ];
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
