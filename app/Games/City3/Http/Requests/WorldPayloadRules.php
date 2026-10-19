<?php

namespace App\Games\City3\Http\Requests;

use App\Games\City3\ContentRepository;
use App\Games\City3\LandRules;
use App\Games\City3\Models\World;
use Closure;
use Illuminate\Validation\Rule;

/**
 * Rules shared by creating and syncing a world. Ids are checked against
 * the game's content files, and every building against the land it
 * stands on (LandRules: the owned strips and its zone, gdd §14). Tiles
 * come as compact rows [x, y, biome, elevation, feature] and are checked
 * by hand — thousands of them would be slow through wildcard rules.
 */
trait WorldPayloadRules
{
    /** The player's stored world, once looked up (false: there is none). */
    private World|false|null $storedWorld = null;

    /**
     * @return array<string, mixed>
     */
    protected function worldRules(): array
    {
        $content = app(ContentRepository::class);
        $techs = $content->techIds();

        return [
            'world' => ['required', 'array'],
            'world.seed' => ['required', 'integer', 'min:0', 'max:4294967295'],
            'world.width' => ['required', 'integer', 'min:16', 'max:256'],
            'world.height' => ['required', 'integer', 'min:16', 'max:256'],
            'world.epoch' => ['required', 'string', Rule::in($content->epochIds())],
            'world.epoch_index' => ['required', 'integer', 'min:0', 'max:50'],
            'world.year' => ['required', 'integer', 'min:0', 'max:9999'],
            'world.time' => ['required', 'integer', 'min:0'],
            'world.population' => ['required', 'integer', 'min:0', 'max:100000000'],
            'world.happiness' => ['required', 'integer', 'min:0', 'max:100'],
            'world.score' => ['required', 'integer', 'min:0'],
            'world.resources' => ['required', 'array:'.implode(',', $content->resourceIds())],
            'world.resources.*' => ['numeric', 'min:0'],
            'world.weather' => ['required', 'string', 'max:32'],
            'world.weather_until' => ['required', 'integer', 'min:0'],
            'world.next_event_at' => ['required', 'integer', 'min:0'],
            'world.moods' => ['present', 'array', 'max:50'],
            'world.next_uid' => ['required', 'integer', 'min:1'],
            'world.stats' => ['present', 'array'],
            'world.techs' => ['present', 'array', 'max:500'],
            'world.techs.*' => ['string', Rule::in($techs)],
            'world.research' => ['nullable', 'array'],
            'world.research.id' => ['required_with:world.research', 'string', Rule::in($techs)],
            'world.research.start' => ['required_with:world.research', 'integer', 'min:0'],
            'world.research.end' => ['required_with:world.research', 'integer', 'min:0'],
            'world.blueprints' => ['present', 'array', 'max:500'],
            'world.blueprints.*' => ['string', Rule::in($content->blueprintIds())],
            'world.achievements' => ['present', 'array', 'max:1000'],
            'world.achievements.*' => ['string', Rule::in($content->goalIds())],
            'world.peak_population' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000000'],
            'world.era_log' => ['sometimes', 'nullable', 'array', 'max:7', $this->eraLogRule()],
            'world.era_log.*' => ['array:era,t'],
            'world.era_log.*.era' => ['required', 'integer', 'min:0', 'max:'.max(0, count($content->epochIds()) - 1)],
            'world.era_log.*.t' => ['required', 'integer', 'min:0'],
            'world.economy' => ['sometimes', 'nullable', 'array:'.implode(',', self::ECONOMY_KEYS)],
            'world.economy.policy' => ['required_with:world.economy', Rule::in(['low', 'normal', 'high'])],
            'world.economy.policyT' => ['nullable', 'integer', 'min:0'],
            'world.economy.dense' => ['sometimes', 'boolean'],
            'world.economy.denseT' => ['nullable', 'integer', 'min:0'],
            'world.economy.loan' => ['sometimes', 'numeric', 'min:0', 'max:1000000000000000'],
            'world.economy.arrears' => ['sometimes', 'boolean'],
            'world.economy.arrearsYears' => ['sometimes', 'integer', 'min:0', 'max:1000000'],
            'world.economy.chestT' => ['nullable', 'integer', 'min:0'],
            'world.economy.h50' => ['sometimes', 'numeric', 'between:0,100'],
            'world.economy.bestH50' => ['sometimes', 'numeric', 'between:0,100'],
            'world.economy.flags' => ['sometimes', 'array:tester'],
            'world.economy.flags.tester' => ['sometimes', 'boolean'],
            'world.land_left' => ['sometimes', 'integer', 'min:0', 'max:'.$content->land()['perSide']],
            'world.land_right' => ['sometimes', 'integer', 'min:0', 'max:'.$content->land()['perSide']],
        ];
    }

    /**
     * The strips bought west and east as the save says, or as stored when
     * it does not say (a save from before slice 5).
     *
     * @return array{0: int, 1: int}
     */
    protected function stripsBought(): array
    {
        $stored = $this->storedWorld();

        return [
            (int) ($this->input('world.land_left') ?? $stored->land_left ?? 0),
            (int) ($this->input('world.land_right') ?? $stored->land_right ?? 0),
        ];
    }

    /**
     * The player's world as stored before this request, if there is one.
     */
    protected function storedWorld(): ?World
    {
        if ($this->storedWorld === null) {
            $user = $this->user();

            $this->storedWorld = $user === null
                ? false
                : (World::query()->where('user_id', $user->getAuthIdentifier())->first() ?? false);
        }

        return $this->storedWorld ?: null;
    }

    /**
     * Land once bought is never given back (gdd §14: strips monotonic).
     */
    protected function landNeverShrinks(string $column): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($column): void {
            $stored = $this->storedWorld();

            if ($stored !== null && is_int($value) && $value < (int) $stored->{$column}) {
                $fail(__('city3::messages.land_shrunk'));
            }
        };
    }

    /**
     * A building stands on the owned land, inside its zone (gdd §5, §14).
     */
    protected function placementRule(): Closure
    {
        return function (string $attribute, mixed $building, Closure $fail): void {
            if (! is_array($building) || ! is_string($building['type'] ?? null) || ! is_int($building['x'] ?? null) || ! is_int($building['y'] ?? null)) {
                return;
            }

            [$west, $east] = $this->stripsBought();
            $error = app(LandRules::class)->placementError($building['type'], $building['x'], $building['y'], $west, $east);

            if ($error !== null) {
                $fail(__('city3::messages.building_'.$error, ['type' => $building['type'], 'x' => $building['x'], 'y' => $building['y']]));
            }
        };
    }

    /**
     * The treasury state a world may keep (gdd §14 `economy`, whitelisted).
     *
     * @var list<string>
     */
    private const array ECONOMY_KEYS = [
        'policy', 'policyT', 'dense', 'denseT', 'loan', 'arrears', 'arrearsYears', 'chestT', 'h50', 'bestH50', 'flags',
    ];

    /**
     * The era log holds together (gdd §14): strictly increasing eras, never
     * past the world's era, at non-decreasing times not after now.
     */
    protected function eraLogRule(): Closure
    {
        return function (string $attribute, mixed $log, Closure $fail): void {
            if (! is_array($log)) {
                return;
            }

            $era = -1;
            $time = 0;

            foreach ($log as $entry) {
                $entryEra = is_array($entry) ? ($entry['era'] ?? null) : null;
                $entryTime = is_array($entry) ? ($entry['t'] ?? null) : null;

                if (
                    ! is_int($entryEra) || ! is_int($entryTime)
                    || $entryEra <= $era || $entryTime < $time
                    || $entryEra > (int) $this->input('world.epoch_index')
                    || $entryTime > (int) $this->input('world.time')
                ) {
                    $fail(__('city3::messages.era_log_invalid'));

                    return;
                }

                $era = $entryEra;
                $time = $entryTime;
            }
        };
    }

    /**
     * @return array<string, mixed>
     */
    protected function buildingRules(string $prefix): array
    {
        return [
            $prefix => ['present', 'array', 'max:6000'],
            "{$prefix}.*" => [$this->placementRule()],
            "{$prefix}.*.uid" => ['required', 'integer', 'min:1'],
            "{$prefix}.*.type" => ['required', 'string', Rule::in(app(ContentRepository::class)->buildingIds())],
            "{$prefix}.*.x" => ['required', 'integer', 'min:0', 'max:255'],
            "{$prefix}.*.y" => ['required', 'integer', 'min:0', 'max:255'],
            "{$prefix}.*.level" => ['required', 'integer', 'min:1', 'max:60'],
            "{$prefix}.*.build_start" => ['required', 'integer', 'min:0'],
            "{$prefix}.*.build_end" => ['required', 'integer', 'min:0'],
            "{$prefix}.*.style" => ['nullable', 'array'],
            "{$prefix}.*.style.blueprint" => ['nullable', 'string', 'max:64'],
            "{$prefix}.*.style.colors" => ['sometimes', 'array', 'max:12'],
            "{$prefix}.*.style.colors.*" => ['string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            "{$prefix}.*.district" => ['nullable', 'array'],
            "{$prefix}.*.district.name" => ['required_with:'.$prefix.'.*.district', 'string', 'max:40'],
            "{$prefix}.*.district.policy" => ['nullable', 'string', 'max:64'],
            "{$prefix}.*.paid" => ['sometimes', 'nullable', 'integer', 'min:0'],
            "{$prefix}.*.mothballed" => ['sometimes', 'boolean'],
            "{$prefix}.*.organic" => ['sometimes', 'numeric', 'between:0,1'],
            "{$prefix}.*.built_era" => ['sometimes', 'nullable', 'integer', 'min:0', 'max:'.max(0, count(app(ContentRepository::class)->epochIds()) - 1)],
            "{$prefix}.*.from_level" => ['sometimes', 'integer', 'min:0', 'max:60'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function npcRules(): array
    {
        return [
            'npcs' => ['present', 'array', 'max:1000'],
            'npcs.*.uid' => ['required', 'integer', 'min:1'],
            'npcs.*.type' => ['required', 'string', 'max:32'],
            'npcs.*.name' => ['required', 'string', 'max:80'],
            'npcs.*.age' => ['required', 'integer', 'min:0', 'max:150'],
            'npcs.*.home_uid' => ['required', 'integer', 'min:1'],
            'npcs.*.work_uid' => ['nullable', 'integer', 'min:1'],
            'npcs.*.x' => ['required', 'numeric', 'min:0', 'max:256'],
            'npcs.*.y' => ['required', 'numeric', 'min:0', 'max:256'],
            'npcs.*.activity' => ['required', Rule::in(['home', 'walking', 'working', 'leisure'])],
            'npcs.*.offset' => ['required', 'numeric', 'between:-1,1'],
        ];
    }

    protected function tilesRule(): Closure
    {
        return function (string $attribute, mixed $tiles, Closure $fail): void {
            $width = (int) $this->input('world.width');
            $height = (int) $this->input('world.height');

            if (! is_array($tiles) || count($tiles) > $width * $height) {
                $fail(__('city3::messages.tiles_too_many'));

                return;
            }

            foreach ($tiles as $index => $row) {
                $valid = is_array($row) && count($row) === 5
                    && is_int($row[0]) && $row[0] >= 0 && $row[0] < $width
                    && is_int($row[1]) && $row[1] >= 0 && $row[1] < $height
                    && is_string($row[2]) && strlen($row[2]) <= 32
                    && is_int($row[3]) && $row[3] >= 0 && $row[3] <= 255
                    && ($row[4] === null || (is_string($row[4]) && strlen($row[4]) <= 16));

                if (! $valid) {
                    $fail(__('city3::messages.tile_invalid', ['index' => $index]));

                    return;
                }
            }
        };
    }
}
