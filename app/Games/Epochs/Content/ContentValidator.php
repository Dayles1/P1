<?php

namespace App\Games\Epochs\Content;

/**
 * Checks a content bundle before the Workshop writes it: every file is
 * there, ids match file names, and every reference (an era, a resource, a
 * biome, a sound, another building) points at something that exists. The
 * game runs the same checks in the browser.
 */
class ContentValidator
{
    /** @var list<array{file: string, path: string, message: string}> */
    private array $issues = [];

    /**
     * @param  array<string, mixed>  $bundle
     * @return list<array{file: string, path: string, message: string}>
     */
    public function validate(array $bundle): array
    {
        $this->issues = [];

        foreach ([...ContentRepository::FILES, 'buildings'] as $file) {
            if (! isset($bundle[$file]) || ! is_array($bundle[$file]) || $bundle[$file] === []) {
                $this->add($file, '', 'Файл отсутствует или пустой');
            }
        }

        if ($this->issues !== []) {
            return $this->issues;
        }

        $resources = $this->ids($bundle['resources']['resources'] ?? []);
        $epochs = $this->ids($bundle['epochs']['epochs'] ?? []);
        $biomes = $this->ids($bundle['biomes']['biomes'] ?? []);
        $seasons = $this->ids($bundle['climate']['seasons'] ?? []);
        $weather = $this->ids($bundle['climate']['weather'] ?? []);
        $sounds = array_map('strval', array_keys($bundle['sounds']['presets'] ?? []));
        $buildings = array_map('strval', array_keys($bundle['buildings']));

        $this->checkWorld($bundle['world'], $resources, $epochs, $buildings, $seasons);
        $this->checkClimate($bundle['climate'], $weather);
        $this->checkEpochs($bundle['epochs']['epochs'] ?? [], $resources, $buildings, array_map('strval', array_keys($bundle['sounds']['ambience'] ?? [])));
        $this->checkNpcs($bundle['npcs']['types'] ?? [], $epochs);

        foreach ($bundle['buildings'] as $key => $building) {
            $this->checkBuilding((string) $key, is_array($building) ? $building : [], $resources, $epochs, $biomes, $sounds, $buildings);
        }

        return $this->issues;
    }

    /**
     * @param  array<string, mixed>  $world
     * @param  list<string>  $resources
     * @param  list<string>  $epochs
     * @param  list<string>  $buildings
     * @param  list<string>  $seasons
     */
    private function checkWorld(array $world, array $resources, array $epochs, array $buildings, array $seasons): void
    {
        $width = $world['map']['width'] ?? 0;
        $height = $world['map']['height'] ?? 0;

        if (! is_int($width) || ! is_int($height) || $width < 16 || $width > 256 || $height < 16 || $height > 256) {
            $this->add('world', 'map', 'Размер карты — от 16 до 256 клеток по каждой стороне');
        }

        if (($world['time']['secondsPerDay'] ?? 0) < 10) {
            $this->add('world', 'time.secondsPerDay', 'Сутки — не короче 10 секунд');
        }

        if (! in_array($world['start']['epoch'] ?? null, $epochs, true)) {
            $this->add('world', 'start.epoch', 'Нет такой эпохи');
        }

        $this->checkAmounts('world', 'start.resources', $world['start']['resources'] ?? [], $resources);

        foreach ($world['start']['buildings'] ?? [] as $index => $start) {
            if (! in_array($start['type'] ?? null, $buildings, true)) {
                $this->add('world', "start.buildings[{$index}]", 'Нет такого здания');
            }
        }

        foreach ($world['events']['list'] ?? [] as $index => $event) {
            $this->checkAmounts('world', "events.list[{$index}].gain", $event['gain'] ?? [], $resources);
            $this->checkAmounts('world', "events.list[{$index}].lose", $event['lose'] ?? [], $resources);

            foreach ($event['seasons'] ?? [] as $season) {
                if (! in_array($season, $seasons, true)) {
                    $this->add('world', "events.list[{$index}].seasons", "Нет сезона «{$season}»");
                }
            }
        }
    }

    /**
     * @param  array<string, mixed>  $climate
     * @param  list<string>  $weather
     */
    private function checkClimate(array $climate, array $weather): void
    {
        foreach ($climate['seasons'] ?? [] as $index => $season) {
            foreach (array_keys($season['weather'] ?? []) as $id) {
                if (! in_array($id, $weather, true)) {
                    $this->add('climate', "seasons[{$index}].weather.{$id}", "Нет погоды «{$id}»");
                }
            }
        }

        $frames = $climate['dayNight']['keyframes'] ?? [];

        if (count($frames) < 2 || ($frames[0]['at'] ?? null) != 0 || (end($frames)['at'] ?? null) != 1) {
            $this->add('climate', 'dayNight.keyframes', 'Ключевые кадры суток должны начинаться с at: 0 и заканчиваться at: 1');
        }
    }

    /**
     * @param  list<array<string, mixed>>  $epochs
     * @param  list<string>  $resources
     * @param  list<string>  $buildings
     * @param  list<string>  $ambience
     */
    private function checkEpochs(array $epochs, array $resources, array $buildings, array $ambience): void
    {
        $previous = null;

        foreach ($epochs as $index => $epoch) {
            if ($previous !== null && ($epoch['year'] ?? 0) <= $previous) {
                $this->add('epochs', "epochs[{$index}].year", 'Годы эпох должны идти по возрастанию');
            }

            $previous = $epoch['year'] ?? 0;

            if (! in_array($epoch['ambience'] ?? null, $ambience, true)) {
                $this->add('epochs', "epochs[{$index}].ambience", 'Нет таких фоновых звуков в sounds.json');
            }

            if (! empty($epoch['next'])) {
                $this->checkAmounts('epochs', "epochs[{$index}].next.cost", $epoch['next']['cost'] ?? [], $resources);

                foreach ($epoch['next']['buildings'] ?? [] as $need) {
                    if (! in_array($need['type'] ?? null, $buildings, true)) {
                        $this->add('epochs', "epochs[{$index}].next.buildings", "Нет здания «{$need['type']}»");
                    }
                }
            }
        }
    }

    /**
     * @param  list<array<string, mixed>>  $types
     * @param  list<string>  $epochs
     */
    private function checkNpcs(array $types, array $epochs): void
    {
        foreach ($types as $index => $type) {
            foreach ($type['epochs'] ?? [] as $epoch) {
                if (! in_array($epoch, $epochs, true)) {
                    $this->add('npcs', "types[{$index}].epochs", "Нет эпохи «{$epoch}»");
                }
            }

            if (empty($type['body'])) {
                $this->add('npcs', "types[{$index}].body", 'Нужен хотя бы один цвет');
            }
        }
    }

    /**
     * @param  array<string, mixed>  $building
     * @param  list<string>  $resources
     * @param  list<string>  $epochs
     * @param  list<string>  $biomes
     * @param  list<string>  $sounds
     * @param  list<string>  $buildings
     */
    private function checkBuilding(string $key, array $building, array $resources, array $epochs, array $biomes, array $sounds, array $buildings): void
    {
        $file = "buildings/{$key}";

        if (($building['id'] ?? null) !== $key) {
            $this->add($file, 'id', "id должен совпадать с именем файла «{$key}»");
        }

        if (! in_array($building['epoch'] ?? null, $epochs, true)) {
            $this->add($file, 'epoch', 'Нет такой эпохи');
        }

        $w = $building['size']['w'] ?? 0;
        $h = $building['size']['h'] ?? 0;

        if (! is_int($w) || ! is_int($h) || $w < 1 || $w > 4 || $h < 1 || $h > 4) {
            $this->add($file, 'size', 'Размер — от 1×1 до 4×4');
        }

        foreach ($building['placement']['biomes'] ?? [] as $biome) {
            if (! in_array($biome, $biomes, true)) {
                $this->add($file, 'placement.biomes', "Нет биома «{$biome}»");
            }
        }

        foreach ($building['sounds'] ?? [] as $slot => $sound) {
            if ($sound !== null && ! in_array($sound, $sounds, true)) {
                $this->add($file, "sounds.{$slot}", "Нет звука «{$sound}» в sounds.json");
            }
        }

        $levels = $building['levels'] ?? [];

        if (! is_array($levels) || $levels === []) {
            $this->add($file, 'levels', 'Нужен хотя бы один уровень');

            return;
        }

        foreach (array_values($levels) as $index => $level) {
            $path = "levels[{$index}]";

            if (($level['level'] ?? null) !== $index + 1) {
                $this->add($file, "{$path}.level", 'Уровни нумеруются по порядку: ожидался '.($index + 1));
            }

            if (isset($level['requiresEpoch']) && ! in_array($level['requiresEpoch'], $epochs, true)) {
                $this->add($file, "{$path}.requiresEpoch", 'Нет такой эпохи');
            }

            $this->checkAmounts($file, "{$path}.cost", $level['cost'] ?? [], $resources);
            $this->checkAmounts($file, "{$path}.effects.produces", $level['effects']['produces'] ?? [], $resources);
            $this->checkAmounts($file, "{$path}.effects.consumes", $level['effects']['consumes'] ?? [], $resources);

            foreach ($level['effects']['boost']['targets'] ?? [] as $target) {
                if (! in_array($target, $buildings, true)) {
                    $this->add($file, "{$path}.effects.boost.targets", "Нет здания «{$target}»");
                }
            }

            if (! isset($level['model']['parts']) || ! is_array($level['model']['parts'])) {
                $this->add($file, "{$path}.model.parts", 'Нужен массив деталей модели');
            }
        }
    }

    /**
     * @param  list<string>  $resources
     */
    private function checkAmounts(string $file, string $path, mixed $amounts, array $resources): void
    {
        if (! is_array($amounts)) {
            $this->add($file, $path, 'Должно быть объектом { ресурс: число }');

            return;
        }

        foreach ($amounts as $id => $value) {
            if (! in_array($id, $resources, true)) {
                $this->add($file, "{$path}.{$id}", "Нет такого ресурса «{$id}»");
            }

            if (! is_int($value) && ! is_float($value) || $value < 0) {
                $this->add($file, "{$path}.{$id}", 'Нужно неотрицательное число');
            }
        }
    }

    /**
     * @return list<string>
     */
    private function ids(mixed $list): array
    {
        return is_array($list) ? array_values(array_filter(array_map(fn ($item) => is_array($item) ? ($item['id'] ?? null) : null, $list), 'is_string')) : [];
    }

    private function add(string $file, string $path, string $message): void
    {
        $this->issues[] = ['file' => $file, 'path' => $path, 'message' => $message];
    }
}
