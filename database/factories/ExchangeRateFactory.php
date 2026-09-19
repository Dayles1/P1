<?php

namespace Database\Factories;

use App\Domain\Currency\Models\Currency;
use App\Domain\Currency\Models\ExchangeRate;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Carbon;

/**
 * @extends Factory<ExchangeRate>
 */
class ExchangeRateFactory extends Factory
{
    protected $model = ExchangeRate::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'currency_id' => Currency::factory(),
            'base_code' => 'USD',
            'rate' => fake()->randomFloat(6, 0.1, 5000),
            'rate_date' => Carbon::today()->toDateString(),
            'source' => 'test',
            'fetched_at' => now(),
        ];
    }

    public function on(Carbon|string $date): self
    {
        return $this->state(fn (): array => [
            'rate_date' => $date instanceof Carbon ? $date->toDateString() : $date,
        ]);
    }
}
