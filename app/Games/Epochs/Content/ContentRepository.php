<?php

namespace App\Games\Epochs\Content;

use Illuminate\Support\Facades\File;
use InvalidArgumentException;
use JsonException;
use stdClass;

/**
 * The game's content files — the settings everything in "Летопись города 2" is
 * built from (map, biomes, climate, eras, resources, NPCs, sounds and one
 * file per building). Reads them for the game and writes them back for
 * the Workshop, always in the same human-friendly JSON layout.
 */
class ContentRepository
{
    /** Top-level files, by key. Buildings are files in buildings/. */
    public const array FILES = ['world', 'resources', 'biomes', 'climate', 'epochs', 'techs', 'blueprints', 'goals', 'npcs', 'sounds'];

    public function path(string $relative = ''): string
    {
        $root = rtrim((string) config('games.epochs.content_path'), '/\\');

        return $relative === '' ? $root : $root.DIRECTORY_SEPARATOR.$relative;
    }

    /**
     * Everything at once, as arrays — for checking it in PHP.
     *
     * @return array<string, mixed>
     */
    public function bundle(): array
    {
        $bundle = [];

        foreach (self::FILES as $file) {
            $bundle[$file] = $this->read($file);
        }

        $bundle['buildings'] = [];

        foreach ($this->buildingIds() as $id) {
            $bundle['buildings'][$id] = $this->read("buildings/{$id}");
        }

        return $bundle;
    }

    /**
     * Everything at once, decoded as objects — for sending to the browser.
     * PHP arrays cannot tell {} from [], so an empty `"produces": {}`
     * would arrive as [] and the Workshop would write it back that way.
     */
    public function bundleForClient(): object
    {
        $bundle = new stdClass;

        foreach (self::FILES as $file) {
            $bundle->{$file} = $this->readRaw($file);
        }

        $bundle->buildings = new stdClass;

        foreach ($this->buildingIds() as $id) {
            $bundle->buildings->{$id} = $this->readRaw("buildings/{$id}");
        }

        return $bundle;
    }

    private function readRaw(string $key): mixed
    {
        $path = $this->path("{$key}.json");

        try {
            return is_file($path) ? json_decode((string) file_get_contents($path), false, 512, JSON_THROW_ON_ERROR) : new stdClass;
        } catch (JsonException) {
            return new stdClass;
        }
    }

    /**
     * A hash that changes whenever any content file does.
     */
    public function version(): string
    {
        $files = [...array_map(fn (string $f): string => $this->path("{$f}.json"), self::FILES)];

        foreach ($this->buildingIds() as $id) {
            $files[] = $this->path("buildings/{$id}.json");
        }

        return substr(md5(implode('|', array_map(fn (string $f): string => $f.':'.(is_file($f) ? md5_file($f) : ''), $files))), 0, 12);
    }

    /**
     * @return list<string>
     */
    public function buildingIds(): array
    {
        $ids = array_map(
            fn (string $file): string => pathinfo($file, PATHINFO_FILENAME),
            glob($this->path('buildings/*.json')) ?: [],
        );

        sort($ids);

        return $ids;
    }

    /**
     * @return array<string, mixed>
     */
    public function read(string $key): array
    {
        $this->assertKey($key);

        $path = $this->path("{$key}.json");

        if (! is_file($path)) {
            return [];
        }

        try {
            return json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return [];
        }
    }

    /**
     * Writes a file from decoded JSON. Pass objects (json_decode without
     * the assoc flag) so empty objects stay {} rather than turning into [].
     */
    public function write(string $key, mixed $data): void
    {
        $this->assertKey($key);

        $path = $this->path("{$key}.json");

        File::ensureDirectoryExists(dirname($path));
        File::put($path, self::encode($data));
    }

    public function delete(string $key): void
    {
        $this->assertKey($key);

        if (! str_starts_with($key, 'buildings/')) {
            throw new InvalidArgumentException('Only building files can be deleted.');
        }

        File::delete($this->path("{$key}.json"));
    }

    public static function isValidKey(string $key): bool
    {
        return in_array($key, self::FILES, true) || preg_match('/^buildings\/[a-z][a-z0-9_]{1,40}$/', $key) === 1;
    }

    /**
     * Pretty JSON with every flat object or array on one line — the
     * layout the content files are kept in, so a part of a building model
     * reads as a single row.
     */
    public static function encode(mixed $data): string
    {
        $json = (string) json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);

        do {
            $previous = $json;
            $json = (string) preg_replace_callback(
                '/([{\[])\n\s*([^{}\[\]]*?)\n\s*([}\]])/',
                function (array $m): string {
                    $inner = implode(', ', preg_split('/,\n\s*/', $m[2]) ?: []);

                    return $m[1] === '{' ? "{ {$inner} }" : "[{$inner}]";
                },
                $json,
            );
        } while ($json !== $previous);

        return $json."\n";
    }

    private function assertKey(string $key): void
    {
        if (! self::isValidKey($key)) {
            throw new InvalidArgumentException("Unknown content file [{$key}].");
        }
    }
}
