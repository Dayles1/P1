<?php

namespace App\Games\Sandbox;

/**
 * The Sandbox's score, for the leaderboard: points for every creature
 * beaten (the more dangerous, the more), every tree felled and boulder
 * broken, every thing made, and twenty for each artifact picked up.
 */
class Score
{
    /**
     * Points per counter in the player's stats.
     *
     * @var array<string, int>
     */
    public const array POINTS = [
        'deer' => 5,
        'boar' => 10,
        'wolf' => 15,
        'zombie' => 20,
        'trees' => 2,
        'rocks' => 2,
        'crafted' => 1,
    ];

    public const int ARTIFACT_POINTS = 20;

    /**
     * Creature kinds whose counters are kills.
     *
     * @var list<string>
     */
    public const array CREATURES = ['deer', 'boar', 'wolf', 'zombie'];

    /**
     * @param  array<string, int>  $stats
     * @param  list<array{id: string, at: int}>  $harvested
     */
    public static function of(array $stats, array $harvested): int
    {
        $points = 0;

        foreach (self::POINTS as $counter => $each) {
            $points += $each * max(0, (int) ($stats[$counter] ?? 0));
        }

        return $points + self::ARTIFACT_POINTS * self::found($stats, $harvested);
    }

    /**
     * Artifacts picked up: the `artifacts` counter, or — for a character
     * from before artifacts came back after a while — those still in the
     * list of what was used up.
     *
     * @param  array<string, int>  $stats
     * @param  list<array{id: string, at: int}>  $harvested
     */
    public static function found(array $stats, array $harvested): int
    {
        return max(max(0, (int) ($stats['artifacts'] ?? 0)), self::artifacts($harvested));
    }

    /**
     * Artifacts in the list of what was used up.
     *
     * @param  list<array{id: string, at: int}>  $harvested
     */
    public static function artifacts(array $harvested): int
    {
        return collect($harvested)
            ->pluck('id')
            ->filter(fn (mixed $id): bool => is_string($id) && str_starts_with($id, 'art:'))
            ->unique()
            ->count();
    }

    /**
     * Creatures beaten, all kinds together.
     *
     * @param  array<string, int>  $stats
     */
    public static function kills(array $stats): int
    {
        return array_sum(array_map(fn (string $kind): int => max(0, (int) ($stats[$kind] ?? 0)), self::CREATURES));
    }
}
