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
            'green' => 'Green',
            'orange' => 'Orange',
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
