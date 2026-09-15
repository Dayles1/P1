<?php

namespace App\Domain\Setting\Services;

class ThemeCatalog
{
    public const DEFAULT = 'system';

    /**
     * Every theme the frontend design system implements, keyed by the value
     * stored on `user_settings.theme`. `system` is a meta-option resolved to
     * `light`/`dark` client-side; the rest are fixed palettes.
     *
     * @return array<string, string>
     */
    public static function options(): array
    {
        return [
            'system' => 'System',
            'light' => 'Light',
            'gray' => 'Gray',
            'dark' => 'Dark',
            'black' => 'Black (AMOLED)',
            'blue' => 'Blue',
            'indigo' => 'Indigo',
            'cyan' => 'Cyan',
            'emerald' => 'Emerald',
            'green' => 'Green',
            'slate' => 'Slate',
            'red' => 'Red',
            'rose' => 'Rose',
            'orange' => 'Orange',
            'warm' => 'Warm',
            'soft' => 'Soft',
            'graphite' => 'Graphite',
            'midnight' => 'Midnight',
            'nord' => 'Nord',
            'high-contrast' => 'High Contrast',
        ];
    }

    /**
     * Codes that resolve to a dark `color-scheme` — used client-side to pick
     * the right icon/contrast for chrome that isn't itself theme-scoped.
     *
     * @return list<string>
     */
    public static function darkCodes(): array
    {
        return ['dark', 'black', 'graphite', 'midnight', 'nord', 'high-contrast'];
    }

    /**
     * @return list<string>
     */
    public static function codes(): array
    {
        return array_keys(self::options());
    }
}
