<?php

namespace App\Games\Epochs\Database\Factories;

use App\Games\Epochs\Models\World;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<World>
 */
class WorldFactory extends Factory
{
    protected $model = World::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => fake()->unique()->numberBetween(1, 1_000_000),
            'revision' => 1,
            'seed' => fake()->numberBetween(1, 2_000_000_000),
            'width' => 72,
            'height' => 72,
            'epoch' => 'e0',
            'epoch_index' => 0,
            'year' => 0,
            'time' => 72,
            'population' => 6,
            'happiness' => 55,
            'score' => 16,
            'resources' => ['food' => 120, 'wood' => 160, 'stone' => 60, 'gold' => 80, 'knowledge' => 0],
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
