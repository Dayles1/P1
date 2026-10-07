<?php

namespace App\Games\CityBuilder\Database\Factories;

use App\Games\CityBuilder\Models\CitySave;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CitySave>
 */
class CitySaveFactory extends Factory
{
    protected $model = CitySave::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => fake()->unique()->numberBetween(1, 1_000_000),
            'revision' => 1,
            'epoch' => 0,
            'year' => 1000,
            'population' => 6,
            'score' => 10,
            'state' => ['version' => 1, 'epoch' => 0, 'year' => 1000, 'buildings' => []],
        ];
    }

    public function inEpoch(int $epoch, int $year, int $population): static
    {
        return $this->state(fn (): array => [
            'epoch' => $epoch,
            'year' => $year,
            'population' => $population,
        ]);
    }
}
