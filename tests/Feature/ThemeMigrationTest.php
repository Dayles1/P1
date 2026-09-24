<?php

use App\Domain\Identity\Models\User;
use App\Domain\Setting\Services\ThemeCatalog;
use Illuminate\Support\Facades\DB;

function themeMigration(): object
{
    return require database_path('migrations/2026_09_24_043923_migrate_user_settings_to_theme_and_accent.php');
}

test('every retired palette folds into a theme and an accent', function (?string $legacy, string $theme, string $accent) {
    expect(ThemeCatalog::fromLegacy($legacy))->toBe(['theme' => $theme, 'accent' => $accent]);
})->with([
    [null, 'auto', 'default'],
    ['system', 'auto', 'default'],
    ['light', 'light', 'default'],
    ['gray', 'light', 'default'],
    ['soft', 'light', 'default'],
    ['blue', 'light', 'default'],
    ['green', 'light', 'teal'],
    ['emerald', 'light', 'teal'],
    ['cyan', 'light', 'teal'],
    ['red', 'light', 'rose'],
    ['rose', 'light', 'rose'],
    ['orange', 'light', 'orange'],
    ['warm', 'light', 'orange'],
    ['indigo', 'light', 'violet'],
    ['dark', 'dark', 'default'],
    ['black', 'dark', 'default'],
    ['midnight', 'dark', 'default'],
    ['graphite', 'dark', 'default'],
    ['slate', 'dark', 'default'],
    ['nord', 'dark', 'default'],
    ['blue-dark', 'dark', 'default'],
    ['soft-dark', 'dark', 'default'],
    ['green-dark', 'dark', 'teal'],
    ['rose-dark', 'dark', 'rose'],
    ['warm-dark', 'dark', 'orange'],
    ['indigo-dark', 'dark', 'violet'],
    ['high-contrast', 'light', 'mono'],
]);

test('the migration rewrites stored palettes and down() restores them exactly', function () {
    $migration = themeMigration();
    $migration->down();

    $rose = User::factory()->create();
    $system = User::factory()->create();
    DB::table('user_settings')->insert([
        ['user_id' => $rose->id, 'theme' => 'rose-dark', 'created_at' => now(), 'updated_at' => now()],
        ['user_id' => $system->id, 'theme' => 'system', 'created_at' => now(), 'updated_at' => now()],
    ]);

    $migration->up();

    expect(DB::table('user_settings')->where('user_id', $rose->id)->first())
        ->theme->toBe('dark')
        ->accent->toBe('rose');
    expect(DB::table('user_settings')->where('user_id', $system->id)->first())
        ->theme->toBe('auto')
        ->accent->toBe('default');

    $migration->down();

    expect(DB::table('user_settings')->where('user_id', $rose->id)->value('theme'))->toBe('rose-dark');
    expect(DB::table('user_settings')->where('user_id', $system->id)->value('theme'))->toBe('system');

    $migration->up();
});
