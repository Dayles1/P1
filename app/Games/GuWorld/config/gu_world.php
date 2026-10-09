<?php

/*
|--------------------------------------------------------------------------
| GU World
|--------------------------------------------------------------------------
|
| A self-contained game: everything it needs lives in app/Games/GuWorld,
| including this file (merged as the `gu_world` config by its provider)
| and its own database. The only thing it shares with the host
| application is who the player is — the user id behind the bearer token.
| It shares nothing with the Sandbox either.
|
*/

return [

    /*
     * The connection the game's tables live on. GuWorldServiceProvider
     * builds it from the default connection with only the database swapped:
     *
     * - mysql / mariadb / pgsql: GU_WORLD_DB_DATABASE, or "<main db>_gu_world".
     * - sqlite: GU_WORLD_DB_DATABASE, or database/gu_world.sqlite
     *   (an in-memory main database gets an in-memory one).
     */
    'connection' => 'gu_world',

    'database' => env('GU_WORLD_DB_DATABASE'),

    /*
     * Where the "back" button in the game leads.
     */
    'back_url' => env('GU_WORLD_BACK_URL', '/games'),

];
