<?php

namespace App\Games\City3;

use App\Games\City3\Models\Building;
use App\Games\City3\Models\Npc;
use App\Games\City3\Models\Tile;
use App\Games\City3\Models\World;
use Illuminate\Support\Facades\DB;

/**
 * Reads and writes a player's world across its four tables. A world is
 * created whole once; afterwards only changes arrive, guarded by a
 * revision so an older tab cannot overwrite newer progress.
 *
 * The calendar year and the score are the server's (gdd §10, §14): the
 * year comes from the game time, the score from the era log (entry years,
 * leads and stars against epochs.json), the peak population (at most 1.2 ×
 * the places of the stored homes), the best 50-year happiness, the land
 * strips bought and the achievements; what the browser says about them is
 * ignored. A world that used tester tools, or whose game time ran faster
 * than the fastest speed allows between saves, or that entered an era
 * implausibly early, stays off the leaderboard.
 */
class WorldStore
{
    /** World columns the browser sends (`year` and `score` are recomputed). */
    private const array WORLD_FIELDS = [
        'seed', 'width', 'height', 'epoch', 'epoch_index', 'year', 'time', 'population', 'happiness', 'score',
        'resources', 'weather', 'weather_until', 'next_event_at', 'moods', 'next_uid', 'stats',
        'techs', 'research', 'blueprints', 'achievements', 'peak_population', 'era_log', 'economy',
        'land_left', 'land_right',
    ];

    /** Building columns the browser sends and reads back. */
    private const array BUILDING_FIELDS = [
        'uid', 'type', 'x', 'y', 'level', 'build_start', 'build_end', 'style', 'district',
        'paid', 'mothballed', 'organic', 'built_era', 'from_level',
    ];

    /** Resident columns the browser sends and reads back. */
    private const array NPC_FIELDS = ['uid', 'type', 'name', 'age', 'home_uid', 'work_uid', 'x', 'y', 'activity', 'offset'];

    /** The fastest speed a player has (×5) with a margin: game seconds per real second (gdd §10). */
    private const float MAX_GAME_RATE = 5.5;

    /** Game seconds of slack on top of that between two saves. */
    private const int TIME_SLACK = 60;

    /** A peak population above this share of the stored homes' places is cut (gdd §10). */
    private const float PEAK_SHARE_OF_HOUSING = 1.2;

    /** An era entered before this share of its ★★★ year is implausible (gdd §10). */
    private const float EARLIEST_ENTRY_SHARE = 0.6;

    public function __construct(private ContentRepository $content) {}

    public function find(int $userId): ?World
    {
        return World::query()->where('user_id', $userId)->first();
    }

    /**
     * The whole world as the game loads it.
     *
     * @return array{revision: int, saved_at: string|null, world: array<string, mixed>, tiles: array<int, array{0: int, 1: int, 2: string, 3: int, 4: string|null}>, buildings: array<int, array<string, mixed>>, npcs: array<int, array<string, mixed>>}
     */
    public function load(World $world): array
    {
        return [
            'revision' => $world->revision,
            'saved_at' => $world->updated_at?->toIso8601String(),
            'world' => $this->worldPayload($world),
            'tiles' => $world->tiles()->orderBy('y')->orderBy('x')->get(['x', 'y', 'biome', 'elevation', 'feature'])
                ->map(fn (Tile $tile): array => [$tile->x, $tile->y, $tile->biome, $tile->elevation, $tile->feature])->all(),
            'buildings' => $world->buildings()->orderBy('uid')->get(self::BUILDING_FIELDS)
                ->map(fn (Building $building): array => $building->only(self::BUILDING_FIELDS))->all(),
            'npcs' => $world->npcs()->orderBy('uid')->get()
                ->map(fn (Npc $npc): array => $npc->only(self::NPC_FIELDS))->all(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data  validated CreateWorldRequest data
     */
    public function create(int $userId, array $data): World
    {
        return DB::connection(config('city3.connection'))->transaction(function () use ($userId, $data): World {
            $world = World::query()->create([
                'user_id' => $userId,
                'revision' => 1,
                ...$this->worldColumns($data['world']),
            ]);

            $this->upsertTiles($world, $data['tiles']);
            $this->upsertBuildings($world, $data['buildings']);
            $this->replaceNpcs($world, $data['npcs']);
            $this->recompute($world, true);

            return $world;
        });
    }

    /**
     * Applies a batch of changes. Returns null when the browser's revision
     * is out of date — unless the batch is forced: then it is the browser's
     * whole city, taken over whatever was saved since, and buildings it
     * does not list are removed.
     *
     * @param  array<string, mixed>  $data  validated SyncWorldRequest data
     */
    public function sync(World $world, array $data): ?World
    {
        return DB::connection(config('city3.connection'))->transaction(function () use ($world, $data): ?World {
            $world = World::query()->whereKey($world->id)->lockForUpdate()->firstOrFail();
            $force = (bool) ($data['force'] ?? false);

            if (! $force && $world->revision !== (int) $data['revision']) {
                return null;
            }

            if ($force) {
                $this->deleteBuildingsExcept($world, array_column($data['buildings']['upsert'], 'uid'));
            }

            $timely = $this->timely($world, (int) $data['world']['time']);

            $world->fill([...$this->worldColumns($data['world']), 'revision' => $world->revision + 1])->save();

            $this->upsertTiles($world, $data['tiles']);
            $this->upsertBuildings($world, $data['buildings']['upsert']);

            if ($data['buildings']['delete'] !== []) {
                $world->buildings()->whereIn('uid', $data['buildings']['delete'])->delete();
            }

            $this->replaceNpcs($world, $data['npcs']);
            $this->recompute($world, $timely);

            return $world;
        });
    }

    public function delete(World $world): void
    {
        DB::connection(config('city3.connection'))->transaction(function () use ($world): void {
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
        return [
            ...$world->only(self::WORLD_FIELDS),
            'techs' => $world->techs ?? [],
            'blueprints' => $world->blueprints ?? [],
            'achievements' => $world->achievements ?? [],
            'peak_population' => $world->peak_population ?? $world->population,
            'era_log' => $world->era_log ?? [],
            'economy' => $world->economy,
            'land_left' => (int) $world->land_left,
            'land_right' => (int) $world->land_right,
        ];
    }

    /**
     * Works out the year, the score and the leaderboard columns from what
     * is stored (gdd §10): the client's score is never used.
     */
    public function recompute(World $world, bool $timely): void
    {
        $economy = $world->economy ?? [];
        $scored = $this->score($world);

        $world->forceFill([
            'peak_population' => $scored['peak'],
            'score' => min(4_294_967_295, $scored['score']),
            'stars' => $scored['stars'],
            'lead' => $scored['lead'],
            'ranked' => ($world->ranked ?? true)
                && $timely
                && $scored['plausible']
                && ! ($economy['flags']['tester'] ?? false),
        ])->save();
    }

    /**
     * The score (gdd §10) = Chronicle + City + Land + Achievements, from the
     * era log, the peak population, the best 50-year happiness, the strips
     * bought (0..7 a side, checked on save) and the achievements.
     *
     * @return array{score: int, stars: int, lead: int, peak: int, plausible: bool}
     */
    public function score(World $world): array
    {
        $rules = $this->content->scoreRules();
        $eras = $this->content->eras();
        $secondsPerYear = $this->content->secondsPerYear();
        $chronicle = 0;
        $stars = 0;
        $lead = 0;
        $plausible = true;

        foreach ($world->era_log ?? [] as $entry) {
            $era = $eras[$entry['era']] ?? null;

            if ($era === null || $entry['era'] < 1) {
                continue;
            }

            $year = intdiv(max(0, $entry['t']), $secondsPerYear);
            $thresholds = $era['stars'];
            $earned = $year > $era['year'] ? 0 : 1
                + ($thresholds !== null && $year <= $thresholds[0] ? 1 : 0)
                + ($thresholds !== null && $year <= $thresholds[1] ? 1 : 0);
            $lead = $era['year'] - $year;
            $stars += $earned;
            $chronicle += $rules['eraBase'] + max(0, $lead) + ($rules['starPoints'][$earned] ?? 0);

            if ($thresholds !== null && $year < self::EARLIEST_ENTRY_SHARE * $thresholds[1]) {
                $plausible = false;
            }
        }

        $housing = $world->buildings()->get(['type', 'level'])
            ->sum(fn (Building $building): int => $this->content->housing($building->type, $building->level));
        $peak = (int) min(
            max((int) $world->peak_population, (int) $world->population),
            floor(self::PEAK_SHARE_OF_HOUSING * $housing),
        );
        $economy = $world->economy ?? [];
        $happiness = (float) (($economy['bestH50'] ?? 0) ?: ($economy['h50'] ?? 0));
        $city = (int) round(
            $rules['cityPerSqrtPeak'] * sqrt(max(0, $peak))
            * ($rules['happinessBase'] + $rules['happinessShare'] * max(0, min(100, $happiness)) / 100),
        );
        $achievements = count(array_intersect(
            array_unique($world->achievements ?? []),
            $this->content->achievementIds(),
        ));

        $strips = max(0, (int) $world->land_left) + max(0, (int) $world->land_right);

        return [
            'score' => $chronicle + $city + $strips * $rules['perStrip'] + $achievements * $rules['perAchievement'],
            'stars' => $stars,
            'lead' => $lead,
            'peak' => $peak,
            'plausible' => $plausible,
        ];
    }

    /**
     * The game time grew no faster than the fastest speed allows since the
     * last save (gdd §10: Δgame ≤ Δwall × 5.5 + 60 s); time never moves back.
     */
    private function timely(World $world, int $time): bool
    {
        $elapsed = $world->updated_at === null ? 0 : max(0, $world->updated_at->diffInSeconds(now()));

        return $time >= $world->time
            && $time - $world->time <= $elapsed * self::MAX_GAME_RATE + self::TIME_SLACK;
    }

    /**
     * The world columns of a save; the calendar year follows the game time.
     *
     * @param  array<string, mixed>  $world
     * @return array<string, mixed>
     */
    private function worldColumns(array $world): array
    {
        $columns = array_intersect_key($world, array_flip(self::WORLD_FIELDS));

        unset($columns['score']);
        $columns['year'] = min(9999, intdiv((int) $world['time'], $this->content->secondsPerYear()));

        return $columns;
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
     * Removes every building of the world but the listed ones (a forced save).
     *
     * @param  list<int>  $keep
     */
    private function deleteBuildingsExcept(World $world, array $keep): void
    {
        $gone = array_values(array_diff($world->buildings()->pluck('uid')->all(), $keep));

        foreach (array_chunk($gone, 500) as $chunk) {
            $world->buildings()->whereIn('uid', $chunk)->delete();
        }
    }

    /**
     * @param  list<array<string, mixed>>  $buildings
     */
    private function upsertBuildings(World $world, array $buildings): void
    {
        $now = now();

        foreach (array_chunk($buildings, 500) as $chunk) {
            Building::query()->upsert(
                array_map(fn (array $building): array => [
                    'world_id' => $world->id,
                    'uid' => $building['uid'],
                    'type' => $building['type'],
                    'x' => $building['x'],
                    'y' => $building['y'],
                    'level' => $building['level'],
                    'build_start' => $building['build_start'],
                    'build_end' => $building['build_end'],
                    'style' => isset($building['style']) ? json_encode($building['style'], JSON_THROW_ON_ERROR) : null,
                    'district' => isset($building['district']) ? json_encode($building['district'], JSON_THROW_ON_ERROR) : null,
                    'paid' => $building['paid'] ?? null,
                    'mothballed' => (bool) ($building['mothballed'] ?? false),
                    'organic' => (float) ($building['organic'] ?? 0),
                    'built_era' => $building['built_era'] ?? null,
                    'from_level' => (int) ($building['from_level'] ?? 0),
                    'created_at' => $now,
                    'updated_at' => $now,
                ], $chunk),
                ['world_id', 'uid'],
                [
                    'type', 'x', 'y', 'level', 'build_start', 'build_end', 'style', 'district',
                    'paid', 'mothballed', 'organic', 'built_era', 'from_level', 'updated_at',
                ],
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
            Npc::query()->insert(array_map(fn (array $npc): array => [
                'world_id' => $world->id,
                'uid' => $npc['uid'],
                'type' => $npc['type'],
                'name' => $npc['name'],
                'age' => $npc['age'],
                'home_uid' => $npc['home_uid'],
                'work_uid' => $npc['work_uid'] ?? null,
                'x' => $npc['x'],
                'y' => $npc['y'],
                'activity' => $npc['activity'],
                'offset' => $npc['offset'],
            ], $chunk));
        }
    }
}
