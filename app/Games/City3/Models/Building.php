<?php

namespace App\Games\City3\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A building a player placed: which one (`type` is a file in
 * app/Games/City3/content/buildings), where, at which level, how the player
 * styled it and — for a district hall — the district's name and policy;
 * the money actually paid for it (refunds and trade-in, gdd §4.9), whether
 * it is mothballed, its organic growth, the era its level was finished in
 * and, while an upgrade builds, the level that keeps working.
 * Everything else about it comes from that file.
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
 * @property array{blueprint: string|null, colors: array<string, string>}|null $style
 * @property array{name: string, policy: string|null}|null $district
 * @property int|null $paid
 * @property bool $mothballed
 * @property float $organic
 * @property int|null $built_era
 * @property int $from_level
 */
class Building extends Model
{
    protected $connection = 'city3';

    protected $table = 'buildings';

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
            'style' => 'array',
            'district' => 'array',
            'paid' => 'integer',
            'mothballed' => 'boolean',
            'organic' => 'float',
            'built_era' => 'integer',
            'from_level' => 'integer',
        ];
    }

    /** @return BelongsTo<World, $this> */
    public function world(): BelongsTo
    {
        return $this->belongsTo(World::class);
    }
}
