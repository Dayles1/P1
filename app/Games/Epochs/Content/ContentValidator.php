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
        $techs = [];

        foreach ($bundle['techs']['techs'] ?? [] as $tech) {
            if (is_array($tech) && is_string($tech['id'] ?? null)) {
                $techs[$tech['id']] = $tech;
            }
        }

        $this->checkWorld($bundle['world'], $resources, $epochs, $buildings, $seasons);
        $this->checkResources($bundle['resources']['resources'] ?? [], $epochs);
        $this->checkClimate($bundle['climate'], $weather);
        $this->checkEpochs($bundle['epochs']['epochs'] ?? [], $resources, $buildings, $techs, $epochs, array_map('strval', array_keys($bundle['sounds']['ambience'] ?? [])));
        $this->checkTechs($techs, $resources, $epochs);
        $this->checkBlueprints($bundle['blueprints']['blueprints'] ?? [], $resources, $epochs, $buildings);
        $this->checkGoals($bundle['goals']['goals'] ?? [], $resources, $epochs, $buildings, array_keys($techs));
        $this->checkNpcs($bundle['npcs']['types'] ?? [], $epochs);

        $roles = [];

        foreach ($bundle['buildings'] as $key => $building) {
            $building = is_array($building) ? $building : [];
            $this->checkBuilding((string) $key, $building, $resources, $epochs, $biomes, $sounds, $buildings, $techs);

            if (isset($building['role']) && is_string($building['role'])) {
                if (isset($roles[$building['role']])) {
                    $this->add("buildings/{$key}", 'role', "Роль «{$building['role']}» уже у здания «{$roles[$building['role']]}»");
                }

                $roles[$building['role']] = (string) $key;
            }
        }

        foreach (['road', 'center'] as $role) {
            if (! isset($roles[$role])) {
                $this->add('buildings', '', "Нужно здание с ролью «{$role}»");
            }
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

        if (($world['districts']['radius'] ?? 0) < 1) {
            $this->add('world', 'districts.radius', 'Радиус округа — от 1 клетки');
        }

        foreach ($world['districts']['policies'] ?? [] as $index => $policy) {
            foreach (array_keys($policy['effects']['produces'] ?? []) as $id) {
                if ($id !== '*' && ! in_array($id, $resources, true)) {
                    $this->add('world', "districts.policies[{$index}].effects.produces.{$id}", "Нет такого ресурса «{$id}»");
                }
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

            foreach ($event['epochs'] ?? [] as $epoch) {
                $this->checkEpochRef('world', "events.list[{$index}].epochs", $epoch, $epochs);
            }
        }
    }

    /**
     * @param  list<array<string, mixed>>  $resources
     * @param  list<string>  $epochs
     */
    private function checkResources(array $resources, array $epochs): void
    {
        foreach ($resources as $index => $resource) {
            $this->checkEpochRef('resources', "resources[{$index}].epoch", $resource['epoch'] ?? null, $epochs);
        }
    }

    /**
     * @param  array<string, array<string, mixed>>  $techs
     * @param  list<string>  $resources
     * @param  list<string>  $epochs
     */
    private function checkTechs(array $techs, array $resources, array $epochs): void
    {
        foreach (array_values($techs) as $index => $tech) {
            $path = "techs[{$index}]";
            $this->checkEpochRef('techs', "{$path}.epoch", $tech['epoch'] ?? null, $epochs);
            $this->checkAmounts('techs', "{$path}.cost", $tech['cost'] ?? [], $resources);

            foreach ($tech['requires'] ?? [] as $required) {
                if (! isset($techs[$required])) {
                    $this->add('techs', "{$path}.requires", "Нет технологии «{$required}»");
                } elseif (array_search($techs[$required]['epoch'] ?? null, $epochs, true) > array_search($tech['epoch'] ?? null, $epochs, true)) {
                    $this->add('techs', "{$path}.requires", "«{$required}» — из более поздней эпохи");
                }
            }

            foreach (array_keys($tech['bonus']['produces'] ?? []) as $id) {
                if ($id !== '*' && ! in_array($id, $resources, true)) {
                    $this->add('techs', "{$path}.bonus.produces.{$id}", "Нет такого ресурса «{$id}»");
                }
            }
        }

        $state = [];
        $cyclic = function (string $id) use (&$cyclic, &$state, $techs): bool {
            if (($state[$id] ?? null) === 'done') {
                return false;
            }

            if (($state[$id] ?? null) === 'visiting') {
                return true;
            }

            $state[$id] = 'visiting';
            $found = false;

            foreach ($techs[$id]['requires'] ?? [] as $required) {
                if (isset($techs[$required]) && $cyclic($required)) {
                    $found = true;
                    break;
                }
            }

            $state[$id] = 'done';

            return $found;
        };

        foreach (array_keys($techs) as $id) {
            if ($cyclic($id)) {
                $this->add('techs', $id, 'Технологии требуют друг друга по кругу');
                break;
            }
        }
    }

    /**
     * @param  list<array<string, mixed>>  $blueprints
     * @param  list<string>  $resources
     * @param  list<string>  $epochs
     * @param  list<string>  $buildings
     */
    private function checkBlueprints(array $blueprints, array $resources, array $epochs, array $buildings): void
    {
        foreach ($blueprints as $index => $blueprint) {
            $path = "blueprints[{$index}]";
            $this->checkEpochRef('blueprints', "{$path}.epoch", $blueprint['epoch'] ?? null, $epochs);
            $this->checkAmounts('blueprints', "{$path}.cost", $blueprint['cost'] ?? [], $resources);

            foreach ($blueprint['buildings'] ?? [] as $building) {
                if (! in_array($building, $buildings, true)) {
                    $this->add('blueprints', "{$path}.buildings", "Нет здания «{$building}»");
                }
            }
        }
    }

    /**
     * @param  list<array<string, mixed>>  $goals
     * @param  list<string>  $resources
     * @param  list<string>  $epochs
     * @param  list<string>  $buildings
     * @param  list<string>  $techs
     */
    private function checkGoals(array $goals, array $resources, array $epochs, array $buildings, array $techs): void
    {
        foreach ($goals as $index => $goal) {
            $path = "goals[{$index}]";
            $condition = $goal['condition'] ?? [];
            $this->checkEpochRef('goals', "{$path}.epoch", $goal['epoch'] ?? null, $epochs);
            $this->checkAmounts('goals', "{$path}.reward", $goal['reward'] ?? [], $resources);

            $missing = match ($condition['type'] ?? null) {
                'building' => in_array($condition['building'] ?? null, $buildings, true) ? null : 'Нет такого здания',
                'epoch' => in_array($condition['epoch'] ?? null, $epochs, true) ? null : 'Нет такой эпохи',
                'tech' => in_array($condition['tech'] ?? null, $techs, true) ? null : 'Нет такой технологии',
                'resource' => in_array($condition['resource'] ?? null, $resources, true) ? null : 'Нет такого ресурса',
                'population', 'techs', 'happiness', 'districts', 'blueprints', 'heritage' => null,
                default => 'Неизвестный тип условия',
            };

            if ($missing !== null) {
                $this->add('goals', "{$path}.condition", $missing);
            }
        }
    }

    /**
     * @param  list<string>  $epochs
     */
    private function checkEpochRef(string $file, string $path, mixed $epoch, array $epochs): void
    {
        if (! in_array($epoch, $epochs, true)) {
            $this->add($file, $path, 'Нет эпохи «'.(is_string($epoch) ? $epoch : '').'»');
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
     * @param  array<string, array<string, mixed>>  $techs
     * @param  list<string>  $epochIds
     * @param  list<string>  $ambience
     */
    private function checkEpochs(array $epochs, array $resources, array $buildings, array $techs, array $epochIds, array $ambience): void
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

                foreach ($epoch['next']['techs'] ?? [] as $tech) {
                    if (! isset($techs[$tech])) {
                        $this->add('epochs', "epochs[{$index}].next.techs", "Нет технологии «{$tech}»");
                    } elseif (array_search($techs[$tech]['epoch'] ?? null, $epochIds, true) > $index) {
                        $this->add('epochs', "epochs[{$index}].next.techs", "Технология «{$tech}» из более поздней эпохи");
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
     * @param  array<string, array<string, mixed>>  $techs
     */
    private function checkBuilding(string $key, array $building, array $resources, array $epochs, array $biomes, array $sounds, array $buildings, array $techs): void
    {
        $file = "buildings/{$key}";

        if (($building['id'] ?? null) !== $key) {
            $this->add($file, 'id', "id должен совпадать с именем файла «{$key}»");
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

        $previousEpoch = -1;

        foreach (array_values($levels) as $index => $level) {
            $path = "levels[{$index}]";

            if (($level['level'] ?? null) !== $index + 1) {
                $this->add($file, "{$path}.level", 'Уровни нумеруются по порядку: ожидался '.($index + 1));
            }

            $this->checkEpochRef($file, "{$path}.epoch", $level['epoch'] ?? null, $epochs);
            $epochIndex = array_search($level['epoch'] ?? null, $epochs, true);

            if ($epochIndex !== false && $epochIndex < $previousEpoch) {
                $this->add($file, "{$path}.epoch", 'Эпохи уровней не должны идти назад');
            }

            $previousEpoch = max($previousEpoch, $epochIndex === false ? -1 : $epochIndex);

            if (isset($level['tech'])) {
                if (! isset($techs[$level['tech']])) {
                    $this->add($file, "{$path}.tech", "Нет технологии «{$level['tech']}»");
                } elseif (array_search($techs[$level['tech']]['epoch'] ?? null, $epochs, true) > $epochIndex) {
                    $this->add($file, "{$path}.tech", "Технология «{$level['tech']}» из более поздней эпохи, чем уровень");
                }
            }

            $this->checkAmounts($file, "{$path}.cost", $level['cost'] ?? [], $resources);
            $this->checkAmounts($file, "{$path}.upgrade", $level['upgrade'] ?? [], $resources);
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
