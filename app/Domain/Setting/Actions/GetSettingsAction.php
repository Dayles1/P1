<?php

namespace App\Domain\Setting\Actions;

use App\Domain\Setting\Models\Setting;
use Illuminate\Support\Collection;

class GetSettingsAction
{
    public function handle(): array
    {
        return Setting::query()
            ->orderBy('group')
            ->orderBy('key')
            ->get()
            ->groupBy('group')
            ->map(function (Collection $items, string $group) {
                return [
                    'group' => $group,
                    'items' => $items->map(fn (Setting $setting) => [
                        'id' => $setting->id,
                        'key' => $setting->key,
                        'value' => $setting->typed_value,
                        'type' => $setting->type,
                        'is_public' => $setting->is_public,
                        'is_locked' => $setting->is_locked,
                    ])->values(),
                ];
            })
            ->values()
            ->all();
    }
}