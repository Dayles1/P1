<?php

namespace App\Domain\Setting\Services;

use App\Domain\Setting\Models\Setting;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class SettingService
{
    public function all(): Collection
    {
        return Setting::query()
            ->get()
            ->keyBy('key');
    }
    // public function all(): Collection
    //     {
    //         return Cache::rememberForever('settings.all', function () {
    //             return Setting::query()
    //                 ->get()
    //                 ->keyBy('key');
    //         });
    //     }

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
        Cache::forget('settings.all');
    }
}
