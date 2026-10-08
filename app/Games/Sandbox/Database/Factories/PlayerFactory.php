<?php

namespace App\Games\Sandbox\Database\Factories;

use App\Games\Sandbox\Models\Player;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Player>
 */
class PlayerFactory extends Factory
{
    protected $model = Player::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => fake()->unique()->numberBetween(1, 1_000_000),
            'x' => fake()->randomFloat(2, -50, 50),
            'y' => fake()->randomFloat(2, 0, 10),
            'z' => fake()->randomFloat(2, -50, 50),
            'yaw' => fake()->randomFloat(2, -3, 3),
        ];
    }
}
