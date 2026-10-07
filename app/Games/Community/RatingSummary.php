<?php

namespace App\Games\Community;

use App\Games\Community\Models\GamePlaytime;
use App\Games\Community\Models\GameRating;
use App\Games\Game;

/**
 * What the Games menu shows about a game's ratings: the average, how the
 * stars are spread, the latest reviews, and the player's own rating and
 * whether they have played long enough to give one.
 */
class RatingSummary
{
    /**
     * How many of the latest commented ratings are shown as reviews.
     */
    private const int RECENT_REVIEWS = 5;

    public function __construct(private PlayerNames $playerNames) {}

    /**
     * @return array<string, array<string, mixed>> keyed by game slug
     */
    public function forPlayer(int $playerId): array
    {
        $counts = GameRating::query()
            ->selectRaw('game, stars, count(*) as total')
            ->groupBy('game', 'stars')
            ->toBase()
            ->get();

        $mine = GameRating::query()->where('user_id', $playerId)->get()->keyBy(fn (GameRating $rating): string => $rating->game->value);
        $playtimes = GamePlaytime::query()->where('user_id', $playerId)->pluck('seconds', 'game');

        $recent = collect(Game::cases())->mapWithKeys(fn (Game $game): array => [
            $game->value => GameRating::query()
                ->where('game', $game)
                ->whereNotNull('comment')
                ->where('comment', '!=', '')
                ->latest('updated_at')
                ->latest('id')
                ->limit(self::RECENT_REVIEWS)
                ->get(),
        ]);

        $names = $this->playerNames->for($recent->flatten()->pluck('user_id'));

        return collect(Game::cases())->mapWithKeys(function (Game $game) use ($counts, $mine, $playtimes, $recent, $names, $playerId): array {
            $distribution = array_fill_keys([1, 2, 3, 4, 5], 0);

            foreach ($counts->where('game', $game->value) as $row) {
                $distribution[(int) $row->stars] = (int) $row->total;
            }

            $count = array_sum($distribution);
            $sum = array_sum(array_map(fn (int $stars, int $total): int => $stars * $total, array_keys($distribution), $distribution));
            $seconds = (int) ($playtimes[$game->value] ?? 0);
            $rating = $mine->get($game->value);

            return [$game->value => [
                'average' => $count === 0 ? null : round($sum / $count, 1),
                'count' => $count,
                'distribution' => $distribution,
                'mine' => $rating === null ? null : ['stars' => $rating->stars, 'comment' => $rating->comment],
                'my_seconds' => $seconds,
                'can_rate' => $seconds >= Game::SECONDS_TO_RATE,
                'recent' => $recent[$game->value]->map(fn (GameRating $review): array => [
                    'name' => $names[$review->user_id],
                    'stars' => $review->stars,
                    'comment' => $review->comment,
                    'at' => $review->updated_at?->toIso8601String(),
                    'is_me' => $review->user_id === $playerId,
                ])->all(),
            ]];
        })->all();
    }
}
