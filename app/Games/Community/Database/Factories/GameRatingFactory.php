<?php

namespace App\Games\Community\Database\Factories;

use App\Games\Community\Models\GameRating;
use App\Games\Game;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GameRating>
 */
class GameRatingFactory extends Factory
{
    protected $model = GameRating::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => fake()->unique()->numberBetween(1, 1_000_000),
            'game' => fake()->randomElement(Game::cases()),
            'stars' => fake()->numberBetween(1, 5),
            'comment' => fake()->optional()->sentence(),
        ];
    }
}
