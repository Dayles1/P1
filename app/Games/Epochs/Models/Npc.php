<?php

namespace App\Games\Epochs\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A resident of a world: name, age, home and workplace (building uids),
 * where they stood when the game was saved and what they were doing.
 *
 * @property int $id
 * @property int $world_id
 * @property int $uid
 * @property string $type
 * @property string $name
 * @property int $age
 * @property int $home_uid
 * @property int|null $work_uid
 * @property float $x
 * @property float $y
 * @property string $activity
 * @property float $offset
 */
class Npc extends Model
{
    public $timestamps = false;

    protected $connection = 'games';

    protected $table = 'epochs_npcs';

    protected $guarded = ['id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'uid' => 'integer',
            'age' => 'integer',
            'home_uid' => 'integer',
            'work_uid' => 'integer',
            'x' => 'float',
            'y' => 'float',
            'offset' => 'float',
        ];
    }

    /** @return BelongsTo<World, $this> */
    public function world(): BelongsTo
    {
        return $this->belongsTo(World::class);
    }
}
