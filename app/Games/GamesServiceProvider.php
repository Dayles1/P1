<?php

namespace App\Games;

use App\Games\Console\InstallGamesCommand;
use Illuminate\Console\Events\CommandStarting;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Throwable;

/**
 * Plugs the games module into the app. Everything games-related —
 * routes, views, translations, migrations, the database connection — is
 * registered from here, so the module stays in app/Games and
 * resources/games; the main application only lists this provider and
 * holds its settings in config/games.php.
 */
class GamesServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->registerConnection();
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/database/migrations');
        $this->loadViewsFrom(resource_path('games/views'), 'games');
        $this->loadTranslationsFrom(__DIR__.'/lang', 'games');

        Route::middleware('web')->group(__DIR__.'/routes/web.php');

        Route::middleware('api')
            ->prefix('api/games')
            ->name('api.games.')
            ->group(__DIR__.'/routes/api.php');

        if ($this->app->runningInConsole()) {
            $this->commands([InstallGamesCommand::class]);
            $this->prepareDatabaseForMigrations();
        }
    }

    /**
     * The `games` connection: the default connection with only the
     * database swapped, unless GAMES_DB_DATABASE names one.
     */
    private function registerConnection(): void
    {
        $default = config('database.connections.'.config('database.default'), []);
        $name = config('games.connection');
        $database = config('games.database');

        if (($default['driver'] ?? null) === 'sqlite') {
            $database ??= ($default['database'] ?? null) === ':memory:' ? ':memory:' : database_path('games.sqlite');
        } else {
            $database ??= ($default['database'] ?? 'laravel').'_games';
        }

        config(["database.connections.{$name}" => [...$default, 'database' => $database, 'url' => null]]);
    }

    /**
     * A plain `php artisan migrate` also runs the games migrations, so the
     * games database is created first when it is missing. `migrate:fresh`
     * only drops the default connection's tables; without wiping the games
     * database too its migrations would fail on tables still there.
     */
    private function prepareDatabaseForMigrations(): void
    {
        Event::listen(function (CommandStarting $event): void {
            if (! in_array($event->command, ['migrate', 'migrate:fresh'], true)) {
                return;
            }

            $games = $this->app->make(GamesDatabase::class);

            try {
                $games->ensureExists();

                if ($event->command === 'migrate:fresh') {
                    $games->dropAllTables();
                }
            } catch (Throwable $exception) {
                report($exception);
            }
        });
    }
}
