<?php

namespace App\Games\Epochs\Models;

use App\Games\Epochs\Database\Factories\WorldFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * A player's world in "City of Eras". `user_id` is the main application's
 * user id (another database, so no relation). The numbers here are the
 * player's progress; the rules they are read against live in the content
 * files.
 *
 * @property int $id
 * @property int $user_id
 * @property int $revision
 * @property int $seed
 * @property int $width
 * @property int $height
 * @property string $epoch
 * @property int $epoch_index
 * @property int $year
 * @property int $time
 * @property int $population
 * @property int $happiness
 * @property int $score
 * @property array<string, float> $resources
 * @property string $weather
 * @property int $weather_until
 * @property int $next_event_at
 * @property list<array<string, mixed>> $moods
 * @property int $next_uid
 * @property array<string, int> $stats
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class World extends Model
{
    /** @use HasFactory<WorldFactory> */
    use HasFactory;

    protected $connection = 'games';

    protected $table = 'epochs_worlds';

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'user_id' => 'integer',
            'revision' => 'integer',
            'seed' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'epoch_index' => 'integer',
            'year' => 'integer',
            'time' => 'integer',
            'population' => 'integer',
            'happiness' => 'integer',
            'score' => 'integer',
            'resources' => 'array',
            'weather_until' => 'integer',
            'next_event_at' => 'integer',
            'moods' => 'array',
            'next_uid' => 'integer',
            'stats' => 'array',
        ];
    }

    /** @return HasMany<Tile, $this> */
    public function tiles(): HasMany
    {
        return $this->hasMany(Tile::class);
    }

    /** @return HasMany<Building, $this> */
    public function buildings(): HasMany
    {
        return $this->hasMany(Building::class);
    }

    /** @return HasMany<Npc, $this> */
    public function npcs(): HasMany
    {
        return $this->hasMany(Npc::class);
    }

    protected static function newFactory(): WorldFactory
    {
        return WorldFactory::new();
    }
}
