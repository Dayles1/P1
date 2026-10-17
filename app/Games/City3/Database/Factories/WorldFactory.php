<?php

namespace App\Games\City3\Database\Factories;

use App\Games\City3\Models\World;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<World>
 */
class WorldFactory extends Factory
{
    protected $model = World::class;

    /**
     * A world just founded in the first era.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => fake()->unique()->numberBetween(1, 1_000_000),
            'revision' => 1,
            'seed' => fake()->numberBetween(999_999_999, 2_000_000_000),
            'width' => 96,
            'height' => 96,
            'epoch' => 'e0',
            'epoch_index' => 0,
            'year' => 0,
            'time' => 72,
            'population' => 6,
            'happiness' => 55,
            'score' => 16,
            'resources' => ['money' => 1200, 'food' => 160, 'mat' => 160, 'goods' => 0, 'fuel' => 0],
            'weather' => 'clear',
            'weather_until' => 0,
            'next_event_at' => 200,
            'moods' => [],
            'next_uid' => 2,
            'stats' => ['built' => 0, 'upgraded' => 0, 'demolished' => 0, 'events' => 0],
            'techs' => [],
            'research' => null,
            'blueprints' => [],
            'achievements' => [],
        ];
    }

    public function inEpoch(string $epoch, int $index, int $year, int $population): static
    {
        return $this->state(fn (): array => [
            'epoch' => $epoch,
            'epoch_index' => $index,
            'year' => $year,
            'population' => $population,
        ]);
    }
}
