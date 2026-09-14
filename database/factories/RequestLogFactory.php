<?php

namespace Database\Factories;

use App\Domain\Identity\Models\RequestLog;
use Illuminate\Database\Eloquent\Factories\Factory;

class RequestLogFactory extends Factory
{
    protected $model = RequestLog::class;

    public function definition(): array
    {
        return [
            'method' => 'GET',
            'path' => '/api/'.fake()->word(),
            'status_code' => 200,
            'ip_address' => fake()->ipv4(),
            'user_agent' => fake()->userAgent(),
            'duration_ms' => fake()->numberBetween(5, 400),
            'created_at' => now(),
        ];
    }
}
