<?php

namespace App\Games\Epochs\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A building a player placed: which one (`type` is a file in
 * content/epochs/buildings), where, and at which level. Everything else
 * about it comes from that file.
 *
 * @property int $id
 * @property int $world_id
 * @property int $uid
 * @property string $type
 * @property int $x
 * @property int $y
 * @property int $level
 * @property int $build_start
 * @property int $build_end
 */
class Building extends Model
{
    protected $connection = 'games';

    protected $table = 'epochs_buildings';

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'uid' => 'integer',
            'x' => 'integer',
            'y' => 'integer',
            'level' => 'integer',
            'build_start' => 'integer',
            'build_end' => 'integer',
        ];
    }

    /** @return BelongsTo<World, $this> */
    public function world(): BelongsTo
    {
        return $this->belongsTo(World::class);
    }
}
