<?php

/*
|--------------------------------------------------------------------------
| Sandbox
|--------------------------------------------------------------------------
|
| A self-contained game: everything it needs lives in app/Games/Sandbox,
| including this file (merged as the `sandbox` config by its provider) and
| its own database. The only thing it shares with the host application is
| who the player is — the user id behind the bearer token.
|
*/

return [

    /*
     * The connection the game's tables live on. SandboxServiceProvider
     * builds it from the default connection with only the database swapped:
     *
     * - mysql / mariadb / pgsql: SANDBOX_DB_DATABASE, or "<main db>_sandbox".
     * - sqlite: SANDBOX_DB_DATABASE, or database/sandbox.sqlite
     *   (an in-memory main database gets an in-memory one).
     */
    'connection' => 'sandbox',

    'database' => env('SANDBOX_DB_DATABASE'),

    /*
     * Where the "back" button in the game leads.
     */
    'back_url' => env('SANDBOX_BACK_URL', '/games'),

];
