<?php

/*
|--------------------------------------------------------------------------
| Летопись города 3 (City Chronicle 3)
|--------------------------------------------------------------------------
|
| A self-contained game: everything it needs lives in app/Games/City3,
| including this file (merged as the `city3` config by its provider), its
| content files and its own database. The only thing it shares with the
| host application is who the player is — the user id behind the bearer
| token — and, through the games hub, play time and ratings.
|
*/

return [

    /*
     * The connection the game's tables live on. City3ServiceProvider
     * builds it from the default connection with only the database swapped:
     *
     * - mysql / mariadb / pgsql: CITY3_DB_DATABASE, or "<main db>_city3".
     * - sqlite: CITY3_DB_DATABASE, or database/city3.sqlite
     *   (an in-memory main database gets an in-memory one).
     */
    'connection' => 'city3',

    'database' => env('CITY3_DB_DATABASE'),

    /*
     * Where the "back" button in the game leads.
     */
    'back_url' => env('CITY3_BACK_URL', '/games'),

    /*
     * The content files the game is built from (eras, technologies,
     * blueprints, goals, one file per building…). The browser bundles the
     * same files at build time; the server reads them to check the ids a
     * saved world refers to.
     */
    'content_path' => dirname(__DIR__).DIRECTORY_SEPARATOR.'content',

    /*
     * Tester tools in the game's menu (infinite resources, finish all,
     * research all, next era, faster speeds). What they give is saved like
     * anything else, so keep them off where people play for real. On by
     * default only in a local environment. CITY3_TESTER_IDS limits them to
     * these user ids (comma-separated); empty means every signed-in user.
     */
    'testers' => [
        'enabled' => (bool) env('CITY3_TESTERS', env('APP_ENV') === 'local'),
        'ids' => array_values(array_filter(array_map('intval', explode(',', (string) env('CITY3_TESTER_IDS', ''))))),
    ],

];
