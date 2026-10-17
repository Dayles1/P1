<?php

namespace App\Games\City3;

use JsonException;

/**
 * Reads the game's content files (app/Games/City3/content) for the server:
 * the ids a saved world may refer to and the era names the hub shows. The
 * browser bundles the same files itself, so nothing here serves them, and
 * nothing writes them. Each file is read at most once per instance.
 *
 * Kept beside the module's classes rather than in a Content namespace: a
 * Content/ folder would be the content/ folder on a case-insensitive disk.
 */
class ContentRepository
{
    /**
     * Decoded files by key, as read so far.
     *
     * @var array<string, array<string, mixed>>
     */
    private array $files = [];

    /** @var list<string>|null */
    private ?array $buildingIds = null;

    public function path(string $relative = ''): string
    {
        $root = rtrim((string) config('city3.content_path'), '/\\');

        return $relative === '' ? $root : $root.DIRECTORY_SEPARATOR.$relative;
    }

    /**
     * A content file decoded as arrays; empty when it is missing or broken.
     *
     * @return array<string, mixed>
     */
    public function read(string $key): array
    {
        if (isset($this->files[$key])) {
            return $this->files[$key];
        }

        $path = $this->path("{$key}.json");

        try {
            $data = is_file($path) ? json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR) : [];
        } catch (JsonException) {
            $data = [];
        }

        return $this->files[$key] = is_array($data) ? $data : [];
    }

    /**
     * Every building type: one file each in buildings/.
     *
     * @return list<string>
     */
    public function buildingIds(): array
    {
        if ($this->buildingIds !== null) {
            return $this->buildingIds;
        }

        $ids = array_map(
            fn (string $file): string => pathinfo($file, PATHINFO_FILENAME),
            glob($this->path('buildings'.DIRECTORY_SEPARATOR.'*.json')) ?: [],
        );

        sort($ids);

        return $this->buildingIds = $ids;
    }

    /**
     * @return list<string>
     */
    public function epochIds(): array
    {
        return $this->ids('epochs', 'epochs');
    }

    /**
     * @return list<string>
     */
    public function techIds(): array
    {
        return $this->ids('techs', 'techs');
    }

    /**
     * @return list<string>
     */
    public function blueprintIds(): array
    {
        return $this->ids('blueprints', 'blueprints');
    }

    /**
     * The ids a world may list as reached: story goals and achievements.
     *
     * @return list<string>
     */
    public function goalIds(): array
    {
        return [...$this->ids('goals', 'story'), ...$this->ids('goals', 'achievements')];
    }

    /**
     * The resources a world keeps: the one currency, the stocks and the flows.
     *
     * @return list<string>
     */
    public function resourceIds(): array
    {
        return $this->ids('resources', 'resources');
    }

    /**
     * The one currency's resource id (world.json economy.currency).
     */
    public function currency(): string
    {
        $currency = $this->read('world')['economy']['currency'] ?? 'money';

        return is_string($currency) ? $currency : 'money';
    }

    /**
     * An era's name as the content files give it; null for an unknown era.
     */
    public function epochName(string $epoch): ?string
    {
        /** @var list<array{id: string, name: string}> $epochs */
        $epochs = $this->read('epochs')['epochs'] ?? [];

        $name = array_column($epochs, 'name', 'id')[$epoch] ?? null;

        return is_string($name) ? $name : null;
    }

    /**
     * The achievement ids (goals.json `achievements`): each is worth points.
     *
     * @return list<string>
     */
    public function achievementIds(): array
    {
        return $this->ids('goals', 'achievements');
    }

    /**
     * Game seconds in a calendar year (world.json time.secondsPerYear).
     */
    public function secondsPerYear(): int
    {
        $seconds = $this->read('world')['time']['secondsPerYear'] ?? 25;

        return is_numeric($seconds) ? max(1, (int) $seconds) : 25;
    }

    /**
     * The eras in order: historical year and the [★★, ★★★] years of entering it.
     *
     * @return list<array{id: string, year: int, stars: array{0: int, 1: int}|null}>
     */
    public function eras(): array
    {
        $eras = [];

        foreach ($this->read('epochs')['epochs'] ?? [] as $epoch) {
            if (! is_array($epoch) || ! is_string($epoch['id'] ?? null)) {
                continue;
            }

            $stars = $epoch['entry']['stars'] ?? null;

            $eras[] = [
                'id' => $epoch['id'],
                'year' => (int) ($epoch['year'] ?? 0),
                'stars' => is_array($stars) && count($stars) === 2 ? [(int) $stars[0], (int) $stars[1]] : null,
            ];
        }

        return $eras;
    }

    /**
     * The score rules (world.json chronicle.score, gdd §10).
     *
     * @return array{eraBase: int, starPoints: list<int>, cityPerSqrtPeak: float, happinessBase: float, happinessShare: float, perStrip: int, perAchievement: int}
     */
    public function scoreRules(): array
    {
        $score = $this->read('world')['chronicle']['score'] ?? [];

        return [
            'eraBase' => (int) ($score['eraBase'] ?? 1000),
            'starPoints' => array_values(array_map('intval', $score['starPoints'] ?? [0, 100, 300, 600])),
            'cityPerSqrtPeak' => (float) ($score['cityPerSqrtPeak'] ?? 20),
            'happinessBase' => (float) ($score['happinessBase'] ?? 0.8),
            'happinessShare' => (float) ($score['happinessShare'] ?? 0.4),
            'perStrip' => (int) ($score['perStrip'] ?? 100),
            'perAchievement' => (int) ($score['perAchievement'] ?? 250),
        ];
    }

    /**
     * Places a building's level offers its residents (0 for an unknown
     * type or level, or a building nobody lives in).
     */
    public function housing(string $type, int $level): int
    {
        if (! in_array($type, $this->buildingIds(), true)) {
            return 0;
        }

        $housing = $this->read("buildings/{$type}")['levels'][$level - 1]['effects']['housing'] ?? 0;

        return is_numeric($housing) ? (int) $housing : 0;
    }

    /**
     * The ids of the entries listed under `$list` in a content file.
     *
     * @return list<string>
     */
    private function ids(string $file, string $list): array
    {
        $entries = $this->read($file)[$list] ?? [];

        return array_values(array_filter(
            array_column(is_array($entries) ? $entries : [], 'id'),
            fn (mixed $id): bool => is_string($id),
        ));
    }
}
