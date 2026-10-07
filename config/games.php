<?php

/*
|--------------------------------------------------------------------------
| Games
|--------------------------------------------------------------------------
|
| The games module lives under app/Games and resources/games and talks
| to its own database; these are its settings. The only thing it shares
| with the main application is who the player is: the authenticated
| user's id, taken from the same bearer token every other API route uses.
|
*/

return [

    /*
     * The connection game tables live on. GamesServiceProvider builds it
     * from the default connection with only the database swapped, so on a
     * fresh checkout it just works — `php artisan games:install` creates
     * the database itself.
     *
     * - mysql / mariadb / pgsql: GAMES_DB_DATABASE, or "<main db>_games".
     * - sqlite: GAMES_DB_DATABASE, or database/games.sqlite
     *   (an in-memory main database gets an in-memory games one).
     */
    'connection' => 'games',

    'database' => env('GAMES_DB_DATABASE'),

    /*
     * Largest saved game state accepted from the browser, in kilobytes.
     */
    'max_save_kb' => (int) env('GAMES_MAX_SAVE_KB', 512),

    /*
     * "Летопись города 2": where its content files (the settings the game is
     * built from) live.
     */
    'epochs' => [
        'content_path' => env('GAMES_EPOCHS_CONTENT', resource_path('games/content/epochs')),
    ],

    /*
     * The Workshop edits those content files from the browser. Off unless
     * GAMES_WORKSHOP is true (on by default only when APP_ENV is local).
     * GAMES_WORKSHOP_EDITORS limits it to these user ids (comma-separated);
     * empty means every signed-in user — fine locally, not in production.
     */
    'workshop' => [
        'enabled' => (bool) env('GAMES_WORKSHOP', env('APP_ENV') === 'local'),
        'editors' => array_values(array_filter(array_map('intval', explode(',', (string) env('GAMES_WORKSHOP_EDITORS', ''))))),
    ],

];
