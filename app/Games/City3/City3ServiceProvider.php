<?php

namespace App\Games\City3;

use Illuminate\Console\Events\CommandStarting;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Throwable;

/**
 * Plugs "Летопись города 3" into the host application. The game is one
 * folder — app/Games/City3, its browser client and content files included
 * — with its own config, routes, views, translations, migrations and
 * database. Outside it, the host knows the game in these places only:
 *
 * - bootstrap/providers.php: this provider, listed before any provider
 *   with a catch-all /games route, so /games/city3 is matched here first;
 * - vite.config.ts: the client/main.tsx input, and the react() `include`
 *   pattern that lets the React plugin compile app/Games/City3/client;
 * - package.json: the "test:city3" script that runs the client's tests;
 * - tests/TestCase.php: 'city3' in $connectionsToTransact;
 * - tests/Feature/Games/City3: the game's feature tests;
 * - App\Games\Game::City3, which lets the games hub time and rate the
 *   game, and its arm in the Community LeaderboardController::query();
 * - the hub's card: its entry in resources/games/src/hub/catalog.ts and
 *   its titles in resources/games/src/shared/i18n.ts.
 *
 * To remove the game, delete the folder and undo every one of these; the
 * TestCase line matters most, since a connection nobody registers any
 * more fails every database test. To move it to another app, copy the
 * folder and the tests and make the first four; the last two come with the
 * games hub, wherever there is one.
 */
class City3ServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/config/city3.php', 'city3');
        $this->registerConnection();

        // One read of the content files per request, however many rules ask.
        $this->app->scoped(ContentRepository::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/Database/Migrations');
        $this->loadViewsFrom(__DIR__.'/views', 'city3');
        $this->loadTranslationsFrom(__DIR__.'/lang', 'city3');

        Route::middleware('web')->group(__DIR__.'/routes/web.php');

        Route::middleware('api')
            ->prefix('api/city3')
            ->name('api.city3.')
            ->group(__DIR__.'/routes/api.php');

        if ($this->app->runningInConsole()) {
            $this->prepareDatabaseForMigrations();
        }
    }

    /**
     * The game's connection: the default connection with only the
     * database swapped, unless CITY3_DB_DATABASE names one.
     */
    private function registerConnection(): void
    {
        $default = config('database.connections.'.config('database.default'), []);
        $name = config('city3.connection');
        $database = config('city3.database');

        if (($default['driver'] ?? null) === 'sqlite') {
            $database ??= ($default['database'] ?? null) === ':memory:' ? ':memory:' : database_path('city3.sqlite');
        } else {
            $database ??= ($default['database'] ?? 'laravel').'_city3';
        }

        config(["database.connections.{$name}" => [...$default, 'database' => $database, 'url' => null]]);
    }

    /**
     * `php artisan migrate` creates the game's database when it is missing;
     * `migrate:fresh` wipes it too, since it only drops the default
     * connection's tables.
     */
    private function prepareDatabaseForMigrations(): void
    {
        Event::listen(function (CommandStarting $event): void {
            if (! in_array($event->command, ['migrate', 'migrate:fresh'], true)) {
                return;
            }

            $database = $this->app->make(City3Database::class);

            try {
                $database->ensureExists();

                if ($event->command === 'migrate:fresh') {
                    $database->dropAllTables();
                }
            } catch (Throwable $exception) {
                report($exception);
            }
        });
    }
}
