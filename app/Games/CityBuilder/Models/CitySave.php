<?php

namespace App\Games\CityBuilder\Models;

use App\Games\CityBuilder\Database\Factories\CitySaveFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * A player's city: the browser's whole game state plus a few numbers
 * copied out of it for the Games menu. `user_id` points at the main
 * application's users table, which lives in another database — hence no
 * relation, only the id.
 *
 * @property int $id
 * @property int $user_id
 * @property int $revision
 * @property int $epoch
 * @property int $year
 * @property int $population
 * @property int $score
 * @property array<string, mixed> $state
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class CitySave extends Model
{
    /** @use HasFactory<CitySaveFactory> */
    use HasFactory;

    protected $connection = 'games';

    protected $fillable = [
        'user_id',
        'revision',
        'epoch',
        'year',
        'population',
        'score',
        'state',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'revision' => 'integer',
            'epoch' => 'integer',
            'year' => 'integer',
            'population' => 'integer',
            'score' => 'integer',
            'state' => 'array',
        ];
    }

    protected static function newFactory(): CitySaveFactory
    {
        return CitySaveFactory::new();
    }
}
