<?php

namespace App\Domain\Setting\Services;

class ThemeCatalog
{
    public const DEFAULT = 'auto';

    public const DEFAULT_ACCENT = 'default';

    /**
     * Every value `user_settings.theme` may hold. `auto` is resolved to
     * `light`/`dark` client-side from the OS preference; the other two are
     * applied as-is to `<html data-theme>`.
     *
     * @return list<string>
     */
    public static function codes(): array
    {
        return ['auto', 'light', 'dark'];
    }

    /**
     * Every value `user_settings.accent` may hold, applied to
     * `<html data-accent>`. `default` sets no attribute at all, so the
     * primary color comes straight from tokens.css.
     *
     * @return list<string>
     */
    public static function accents(): array
    {
        return ['default', 'teal', 'violet', 'orange', 'rose', 'mono'];
    }

    /**
     * Where a palette from the retired 29-theme catalog lands in the
     * theme + accent pair that replaced it.
     *
     * @return array{theme: string, accent: string}
     */
    public static function fromLegacy(?string $legacyTheme): array
    {
        $theme = match (true) {
            $legacyTheme === null, $legacyTheme === 'system' => 'auto',
            in_array($legacyTheme, ['dark', 'black', 'midnight', 'graphite', 'slate', 'nord'], true),
            str_ends_with($legacyTheme, '-dark') => 'dark',
            default => 'light',
        };

        $hue = $legacyTheme === null ? '' : preg_replace('/-(dark|light)$/', '', $legacyTheme);

        $accent = match ($hue) {
            'emerald', 'green', 'cyan' => 'teal',
            'red', 'rose' => 'rose',
            'orange', 'warm' => 'orange',
            'indigo' => 'violet',
            'high-contrast' => 'mono',
            default => self::DEFAULT_ACCENT,
        };

        return ['theme' => $theme, 'accent' => $accent];
    }
}
