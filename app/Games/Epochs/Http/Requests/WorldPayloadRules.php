<?php

namespace App\Games\Epochs\Http\Requests;

use App\Games\Epochs\Content\ContentRepository;
use Closure;
use Illuminate\Validation\Rule;

/**
 * Rules shared by creating and syncing a world. Tiles come as compact rows
 * [x, y, biome, elevation, feature] and are checked by hand — thousands of
 * them would be slow through wildcard rules.
 */
trait WorldPayloadRules
{
    /**
     * @return array<string, mixed>
     */
    protected function worldRules(): array
    {
        $epochs = array_column(app(ContentRepository::class)->read('epochs')['epochs'] ?? [], 'id');

        return [
            'world' => ['required', 'array'],
            'world.seed' => ['required', 'integer', 'min:0', 'max:4294967295'],
            'world.width' => ['required', 'integer', 'min:16', 'max:256'],
            'world.height' => ['required', 'integer', 'min:16', 'max:256'],
            'world.epoch' => ['required', 'string', Rule::in($epochs)],
            'world.epoch_index' => ['required', 'integer', 'min:0', 'max:50'],
            'world.year' => ['required', 'integer', 'min:0', 'max:9999'],
            'world.time' => ['required', 'integer', 'min:0'],
            'world.population' => ['required', 'integer', 'min:0', 'max:100000000'],
            'world.happiness' => ['required', 'integer', 'min:0', 'max:100'],
            'world.score' => ['required', 'integer', 'min:0'],
            'world.resources' => ['required', 'array'],
            'world.resources.*' => ['numeric', 'min:0'],
            'world.weather' => ['required', 'string', 'max:32'],
            'world.weather_until' => ['required', 'integer', 'min:0'],
            'world.next_event_at' => ['required', 'integer', 'min:0'],
            'world.moods' => ['present', 'array', 'max:50'],
            'world.next_uid' => ['required', 'integer', 'min:1'],
            'world.stats' => ['present', 'array'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function buildingRules(string $prefix): array
    {
        return [
            $prefix => ['present', 'array', 'max:6000'],
            "{$prefix}.*.uid" => ['required', 'integer', 'min:1'],
            "{$prefix}.*.type" => ['required', 'string', Rule::in(app(ContentRepository::class)->buildingIds())],
            "{$prefix}.*.x" => ['required', 'integer', 'min:0', 'max:255'],
            "{$prefix}.*.y" => ['required', 'integer', 'min:0', 'max:255'],
            "{$prefix}.*.level" => ['required', 'integer', 'min:1', 'max:20'],
            "{$prefix}.*.build_start" => ['required', 'integer', 'min:0'],
            "{$prefix}.*.build_end" => ['required', 'integer', 'min:0'],
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
                $fail('Слишком много клеток для такой карты.');

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
                    $fail("Клетка #{$index}: ожидается [x, y, биом, высота, объект] в пределах карты.");

                    return;
                }
            }
        };
    }
}
