<?php

namespace App\Games\Community\Database\Factories;

use App\Games\Community\Models\GamePlaytime;
use App\Games\Game;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GamePlaytime>
 */
class GamePlaytimeFactory extends Factory
{
    protected $model = GamePlaytime::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => fake()->unique()->numberBetween(1, 1_000_000),
            'game' => fake()->randomElement(Game::cases()),
            'seconds' => fake()->numberBetween(0, 36_000),
            'last_ping_at' => now(),
        ];
    }

    /**
     * Enough play time to rate the game.
     */
    public function canRate(): static
    {
        return $this->state(fn (): array => ['seconds' => Game::SECONDS_TO_RATE]);
    }
}
