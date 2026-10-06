<?php

namespace App\Domain\Setting\Services;

use App\Domain\Setting\Models\Setting;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class SettingService
{
    /** @var Collection<string, Setting>|null */
    private ?Collection $loaded = null;

    /** The request the settings above were read for. */
    private ?object $loadedFor = null;

    /**
     * Every setting, keyed by its key — read from the database once per
     * request. Formatting a single date reads the app timezone from here,
     * and a page of messages formats dozens of them; reading the table
     * each time cost about 60 queries per page.
     *
     * Bound as scoped (AppServiceProvider), so a queued job starts fresh;
     * the request check covers the one container serving many requests
     * (the test suite) and a write made between two of them.
     *
     * @return Collection<string, Setting>
     */
    public function all(): Collection
    {
        $request = app()->bound('request') ? app('request') : null;

        if ($this->loaded === null || $this->loadedFor !== $request) {
            $this->loaded = Setting::query()->get()->keyBy('key');
            $this->loadedFor = $request;
        }

        return $this->loaded;
    }

    public function get(string $key, mixed $default = null): mixed
    {
        $setting = $this->all()->get($key);

        if (! $setting instanceof Setting) {
            return $default;
        }

        return Setting::castValue($setting->value, $setting->type);
    }

    public function boolean(string $key, bool $default = false): bool
    {
        return (bool) $this->get($key, $default);
    }

    public function integer(string $key, int $default = 0): int
    {
        return (int) $this->get($key, $default);
    }

    public function string(string $key, string $default = ''): string
    {
        return (string) $this->get($key, $default);
    }

    public function json(string $key, array $default = []): array
    {
        $value = $this->get($key, $default);

        return is_array($value) ? $value : $default;
    }

    public function forget(): void
    {
        $this->loaded = null;

        Cache::forget('settings.all');
    }
}
