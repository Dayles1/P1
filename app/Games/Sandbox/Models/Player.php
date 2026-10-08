<?php

namespace App\Games\Sandbox\Models;

use App\Games\Sandbox\Database\Factories\PlayerFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A player's character in the world: who the hero is (class, gender,
 * level), where it stands, which way it faces, how healthy it is and how
 * much mana it has, what it carries and wears, what it has used up and
 * built, what it has done and what it has learnt. `user_id` points at
 * the host application's users table, which lives in another database —
 * hence no relation, only the id.
 *
 * @property int $id
 * @property int $user_id
 * @property float $x
 * @property float $y
 * @property float $z
 * @property float $yaw
 * @property array{class: string, gender: string, level: int, xp: int, points: array<string, int>, absorbed?: array<string, int>}|null $hero
 * @property float|null $health
 * @property float|null $mana
 * @property list<array{item: string, count: int, wear?: int}|null>|null $inventory
 * @property array{head: array{item: string, count: int, wear?: int}|null, body: array{item: string, count: int, wear?: int}|null, feet: array{item: string, count: int, wear?: int}|null}|null $equipment
 * @property list<array{id: string, at: int}>|null $harvested
 * @property list<array{type: string, x: float, z: float, yaw?: float, items?: list<array{item: string, count: int, wear?: int}|null>, open?: bool, spawn?: bool}>|null $placed
 * @property array<string, int>|null $stats
 * @property array{points: int, known: list<string>}|null $research
 * @property int $score
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
        'hero',
        'health',
        'mana',
        'inventory',
        'equipment',
        'harvested',
        'placed',
        'stats',
        'research',
        'score',
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
            'hero' => 'array',
            'health' => 'float',
            'mana' => 'float',
            'inventory' => 'array',
            'equipment' => 'array',
            'harvested' => 'array',
            'placed' => 'array',
            'stats' => 'array',
            'research' => 'array',
            'score' => 'integer',
        ];
    }

    protected static function newFactory(): PlayerFactory
    {
        return PlayerFactory::new();
    }
}
