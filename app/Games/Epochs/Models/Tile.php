<?php

namespace App\Games\Epochs\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One cell of a world's map at (x, y): its biome (an id from
 * biomes.json), its height and what grows or lies on it.
 *
 * @property int $id
 * @property int $world_id
 * @property int $x
 * @property int $y
 * @property string $biome
 * @property int $elevation
 * @property string|null $feature
 */
class Tile extends Model
{
    public $timestamps = false;

    protected $connection = 'games';

    protected $table = 'epochs_tiles';

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['x' => 'integer', 'y' => 'integer', 'elevation' => 'integer'];
    }

    /** @return BelongsTo<World, $this> */
    public function world(): BelongsTo
    {
        return $this->belongsTo(World::class);
    }
}
