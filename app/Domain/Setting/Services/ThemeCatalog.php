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

            // Every accent color below comes as a pair: a bright/light
            // surface and a near-black/dark surface with the same accent —
            // pick whichever suits, not just one fixed "Green".
            'blue' => 'Blue Light',
            'blue-dark' => 'Blue Dark',
            'indigo' => 'Indigo Light',
            'indigo-dark' => 'Indigo Dark',
            'cyan' => 'Cyan Light',
            'cyan-dark' => 'Cyan Dark',
            'emerald' => 'Emerald Light',
            'emerald-dark' => 'Emerald Dark',
            'green' => 'Green Light',
            'green-dark' => 'Green Dark',
            'red' => 'Red Light',
            'red-dark' => 'Red Dark',
            'rose' => 'Rose Light',
            'rose-dark' => 'Rose Dark',
            'orange' => 'Orange Light',
            'orange-dark' => 'Orange Dark',
            'warm' => 'Warm Light',
            'warm-dark' => 'Warm Dark',
            'soft' => 'Soft Light',
            'soft-dark' => 'Soft Dark',

            'slate' => 'Slate',
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
        return [
            'dark', 'black', 'graphite', 'midnight', 'nord', 'high-contrast',
            'blue-dark', 'indigo-dark', 'cyan-dark', 'emerald-dark', 'green-dark',
            'red-dark', 'rose-dark', 'orange-dark', 'warm-dark', 'soft-dark',
        ];
    }

    /**
     * @return list<string>
     */
    public static function codes(): array
    {
        return array_keys(self::options());
    }
}
