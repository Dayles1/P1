<?php

namespace App\Games\Epochs;

use App\Games\Epochs\Models\Building;
use App\Games\Epochs\Models\Npc;
use App\Games\Epochs\Models\Tile;
use App\Games\Epochs\Models\World;
use Illuminate\Support\Facades\DB;

/**
 * Reads and writes a player's world across its four tables. A world is
 * created whole once; afterwards only changes arrive, guarded by a
 * revision so an older tab cannot overwrite newer progress.
 */
class WorldStore
{
    /** World columns the browser sends. */
    private const array WORLD_FIELDS = [
        'seed', 'width', 'height', 'epoch', 'epoch_index', 'year', 'time', 'population', 'happiness', 'score',
        'resources', 'weather', 'weather_until', 'next_event_at', 'moods', 'next_uid', 'stats',
    ];

    public function find(int $userId): ?World
    {
        return World::query()->where('user_id', $userId)->first();
    }

    /**
     * The whole world as the game loads it.
     *
     * @return array<string, mixed>
     */
    public function load(World $world): array
    {
        return [
            'revision' => $world->revision,
            'saved_at' => $world->updated_at?->toIso8601String(),
            'world' => $this->worldPayload($world),
            'tiles' => $world->tiles()->orderBy('y')->orderBy('x')->get(['x', 'y', 'biome', 'elevation', 'feature'])
                ->map(fn (Tile $t): array => [$t->x, $t->y, $t->biome, $t->elevation, $t->feature])->all(),
            'buildings' => $world->buildings()->orderBy('uid')->get(['uid', 'type', 'x', 'y', 'level', 'build_start', 'build_end'])
                ->map(fn (Building $b): array => $b->only(['uid', 'type', 'x', 'y', 'level', 'build_start', 'build_end']))->all(),
            'npcs' => $world->npcs()->orderBy('uid')->get()
                ->map(fn (Npc $n): array => $n->only(['uid', 'type', 'name', 'age', 'home_uid', 'work_uid', 'x', 'y', 'activity', 'offset']))->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data  validated CreateWorldRequest data
     */
    public function create(int $userId, array $data): World
    {
        return DB::connection(config('games.connection'))->transaction(function () use ($userId, $data): World {
            $world = World::query()->create([
                'user_id' => $userId,
                'revision' => 1,
                ...$this->worldColumns($data['world']),
            ]);

            $this->upsertTiles($world, $data['tiles']);
            $this->upsertBuildings($world, $data['buildings']);
            $this->replaceNpcs($world, $data['npcs']);

            return $world;
        });
    }

    /**
     * Applies a batch of changes. Returns null when the browser's revision
     * is out of date.
     *
     * @param  array<string, mixed>  $data  validated SyncWorldRequest data
     */
    public function sync(World $world, array $data): ?World
    {
        return DB::connection(config('games.connection'))->transaction(function () use ($world, $data): ?World {
            $world = World::query()->whereKey($world->id)->lockForUpdate()->firstOrFail();

            if ($world->revision !== (int) $data['revision']) {
                return null;
            }

            $world->fill([...$this->worldColumns($data['world']), 'revision' => $world->revision + 1])->save();

            $this->upsertTiles($world, $data['tiles']);
            $this->upsertBuildings($world, $data['buildings']['upsert']);

            if ($data['buildings']['delete'] !== []) {
                $world->buildings()->whereIn('uid', $data['buildings']['delete'])->delete();
            }

            $this->replaceNpcs($world, $data['npcs']);

            return $world;
        });
    }

    public function delete(World $world): void
    {
        DB::connection(config('games.connection'))->transaction(function () use ($world): void {
            $world->npcs()->delete();
            $world->buildings()->delete();
            $world->tiles()->delete();
            $world->delete();
        });
    }

    /**
     * @return array<string, mixed>
     */
    public function worldPayload(World $world): array
    {
        return $world->only(self::WORLD_FIELDS);
    }

    /**
     * @param  array<string, mixed>  $world
     * @return array<string, mixed>
     */
    private function worldColumns(array $world): array
    {
        return array_intersect_key($world, array_flip(self::WORLD_FIELDS));
    }

    /**
     * @param  list<array{0: int, 1: int, 2: string, 3: int, 4: string|null}>  $tiles
     */
    private function upsertTiles(World $world, array $tiles): void
    {
        foreach (array_chunk($tiles, 800) as $chunk) {
            Tile::query()->upsert(
                array_map(fn (array $row): array => [
                    'world_id' => $world->id,
                    'x' => $row[0],
                    'y' => $row[1],
                    'biome' => $row[2],
                    'elevation' => $row[3],
                    'feature' => $row[4],
                ], $chunk),
                ['world_id', 'x', 'y'],
                ['biome', 'elevation', 'feature'],
            );
        }
    }

    /**
     * @param  list<array<string, int|string>>  $buildings
     */
    private function upsertBuildings(World $world, array $buildings): void
    {
        $now = now();

        foreach (array_chunk($buildings, 500) as $chunk) {
            Building::query()->upsert(
                array_map(fn (array $b): array => [
                    'world_id' => $world->id,
                    'uid' => $b['uid'],
                    'type' => $b['type'],
                    'x' => $b['x'],
                    'y' => $b['y'],
                    'level' => $b['level'],
                    'build_start' => $b['build_start'],
                    'build_end' => $b['build_end'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ], $chunk),
                ['world_id', 'uid'],
                ['type', 'x', 'y', 'level', 'build_start', 'build_end', 'updated_at'],
            );
        }
    }

    /**
     * @param  list<array<string, mixed>>  $npcs
     */
    private function replaceNpcs(World $world, array $npcs): void
    {
        $world->npcs()->delete();

        foreach (array_chunk($npcs, 500) as $chunk) {
            Npc::query()->insert(array_map(fn (array $n): array => [
                'world_id' => $world->id,
                'uid' => $n['uid'],
                'type' => $n['type'],
                'name' => $n['name'],
                'age' => $n['age'],
                'home_uid' => $n['home_uid'],
                'work_uid' => $n['work_uid'] ?? null,
                'x' => $n['x'],
                'y' => $n['y'],
                'activity' => $n['activity'],
                'offset' => $n['offset'],
            ], $chunk));
        }
    }
}
