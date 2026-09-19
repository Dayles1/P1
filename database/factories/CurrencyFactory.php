<?php

namespace Database\Factories;

use App\Domain\Currency\Models\Currency;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Currency>
 */
class CurrencyFactory extends Factory
{
    protected $model = Currency::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'code' => strtoupper(fake()->unique()->lexify('???')),
            'name' => fake()->words(2, true),
            'symbol' => null,
            'decimals' => 2,
            'is_active' => true,
        ];
    }

    /**
     * A real currency, so a test can name the one it means.
     */
    public function code(string $code, ?string $name = null, ?string $symbol = null, int $decimals = 2): self
    {
        return $this->state(fn (): array => [
            'code' => strtoupper($code),
            'name' => $name ?? strtoupper($code),
            'symbol' => $symbol,
            'decimals' => $decimals,
        ]);
    }

    public function inactive(): self
    {
        return $this->state(fn (): array => ['is_active' => false]);
    }
}
