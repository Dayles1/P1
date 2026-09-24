<?php

use App\Domain\Setting\Services\ThemeCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The 29-palette theme catalog became `auto`/`light`/`dark` plus a separate
 * accent color. Every stored palette is folded into that pair, and the
 * original value is parked in `legacy_theme` so down() can put it back
 * exactly — the mapping is many-to-one, so it can't be reversed from the
 * new columns alone. Drop `legacy_theme` once the redesign has settled.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            $table->string('accent', 20)
                ->default(ThemeCatalog::DEFAULT_ACCENT)
                ->after('theme');

            $table->string('legacy_theme', 20)
                ->nullable()
                ->after('accent');
        });

        DB::table('user_settings')->orderBy('id')->each(function (object $row): void {
            $mapped = ThemeCatalog::fromLegacy($row->theme);

            DB::table('user_settings')->where('id', $row->id)->update([
                'legacy_theme' => $row->theme,
                'theme' => $mapped['theme'],
                'accent' => $mapped['accent'],
            ]);
        });

        Schema::table('user_settings', function (Blueprint $table) {
            $table->string('theme', 20)->nullable()->default(ThemeCatalog::DEFAULT)->change();
        });
    }

    public function down(): void
    {
        DB::table('user_settings')->orderBy('id')->each(function (object $row): void {
            DB::table('user_settings')->where('id', $row->id)->update([
                'theme' => $row->legacy_theme ?? ($row->theme === 'auto' ? 'system' : $row->theme),
            ]);
        });

        Schema::table('user_settings', function (Blueprint $table) {
            $table->string('theme', 20)->nullable()->default('system')->change();
            $table->dropColumn(['accent', 'legacy_theme']);
        });
    }
};
