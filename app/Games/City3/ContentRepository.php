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
     * @return list<string>
     */
    public function goalIds(): array
    {
        return $this->ids('goals', 'goals');
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
