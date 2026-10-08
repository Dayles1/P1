<?php

namespace App\Games\Sandbox\Models;

use App\Games\Sandbox\Database\Factories\PlayerFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A player's character in the world: where it stands, which way it
 * faces, how healthy it is, what it carries and wears, what it has used up
 * and built, and what it has done. `user_id` points at the host
 * application's users table, which lives in another database — hence no
 * relation, only the id.
 *
 * @property int $id
 * @property int $user_id
 * @property float $x
 * @property float $y
 * @property float $z
 * @property float $yaw
 * @property float|null $health
 * @property list<array{item: string, count: int, wear?: int}|null>|null $inventory
 * @property array{head: array{item: string, count: int, wear?: int}|null, body: array{item: string, count: int, wear?: int}|null, feet: array{item: string, count: int, wear?: int}|null}|null $equipment
 * @property list<array{id: string, at: int}>|null $harvested
 * @property list<array{type: string, x: float, z: float, yaw?: float, items?: list<array{item: string, count: int, wear?: int}|null>, open?: bool, spawn?: bool}>|null $placed
 * @property array<string, int>|null $stats
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Player extends Model
{
    /** @use HasFactory<PlayerFactory> */
    use HasFactory;

    protected $connection = 'sandbox';

    protected $fillable = [
        'user_id',
        'x',
        'y',
        'z',
        'yaw',
        'health',
        'inventory',
        'equipment',
        'harvested',
        'placed',
        'stats',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'x' => 'float',
            'y' => 'float',
            'z' => 'float',
            'yaw' => 'float',
            'health' => 'float',
            'inventory' => 'array',
            'equipment' => 'array',
            'harvested' => 'array',
            'placed' => 'array',
            'stats' => 'array',
        ];
    }

    protected static function newFactory(): PlayerFactory
    {
        return PlayerFactory::new();
    }
}
