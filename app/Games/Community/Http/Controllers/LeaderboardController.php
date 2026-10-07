<?php

namespace App\Games\Community\Http\Controllers;

use App\Games\CityBuilder\Models\CitySave;
use App\Games\Community\PlayerNames;
use App\Games\Epochs\Content\ContentRepository;
use App\Games\Epochs\Models\World;
use App\Games\Game;
use App\Games\Http\Controllers\GameController;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The best players of a game by score, and where the player stands. Ties
 * share a rank (1, 2, 2, 4); among them whoever got there first is listed
 * first.
 */
class LeaderboardController extends GameController
{
    /**
     * How many players the leaderboard lists.
     */
    private const int SIZE = 20;

    /**
     * Epoch names by id, read from the content files once per request.
     *
     * @var array<string, string>|null
     */
    private ?array $epochNames = null;

    public function __construct(private PlayerNames $playerNames, private ContentRepository $content) {}

    public function show(Request $request, Game $game): JsonResponse
    {
        $playerId = $this->playerId($request);
        $query = $this->query($game);

        $top = (clone $query)
            ->orderByDesc('score')
            ->orderBy('updated_at')
            ->orderBy('id')
            ->limit(self::SIZE)
            ->get();

        $mine = (clone $query)->where('user_id', $playerId)->first();
        $names = $this->playerNames->for($top->pluck('user_id')->push($playerId));

        $entries = [];
        $rank = 0;
        $previousScore = null;

        foreach ($top->values() as $position => $save) {
            if ($save->score !== $previousScore) {
                $rank = $position + 1;
                $previousScore = $save->score;
            }

            $entries[] = [
                'rank' => $rank,
                'name' => $names[$save->user_id],
                'score' => $save->score,
                'details' => $this->details($save),
                'is_me' => $save->user_id === $playerId,
            ];
        }

        return $this->success([
            'game' => $game->value,
            'entries' => $entries,
            'me' => $mine === null ? null : [
                'rank' => (clone $query)->where('score', '>', $mine->score)->count() + 1,
                'name' => $names[$playerId],
                'score' => $mine->score,
                'details' => $this->details($mine),
            ],
        ]);
    }

    /**
     * Each game's saves, with the columns the leaderboard reads.
     *
     * @return Builder<CitySave>|Builder<World>
     */
    private function query(Game $game): Builder
    {
        return match ($game) {
            Game::City => CitySave::query()->select(['id', 'user_id', 'score', 'epoch', 'year', 'population', 'updated_at']),
            Game::Epochs => World::query()->select(['id', 'user_id', 'score', 'epoch', 'epoch_index', 'year', 'population', 'updated_at']),
        };
    }

    /**
     * What is shown next to the score: how far the player's city has come.
     *
     * @return array{epoch: int|string, epoch_name?: string|null, year: int, population: int}
     */
    private function details(CitySave|World $save): array
    {
        if ($save instanceof World) {
            return [
                'epoch' => $save->epoch,
                'epoch_name' => $this->epochName($save->epoch),
                'year' => $save->year,
                'population' => $save->population,
            ];
        }

        return [
            'epoch' => $save->epoch,
            'year' => $save->year,
            'population' => $save->population,
        ];
    }

    private function epochName(string $epoch): ?string
    {
        if ($this->epochNames === null) {
            /** @var list<array{id: string, name: string}> $epochs */
            $epochs = $this->content->read('epochs')['epochs'] ?? [];

            $this->epochNames = array_column($epochs, 'name', 'id');
        }

        return $this->epochNames[$epoch] ?? null;
    }
}
