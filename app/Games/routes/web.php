<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Games — the single-page app
|--------------------------------------------------------------------------
|
| Every /games URL serves the same HTML shell; the React app in
| resources/games/src routes on the client. Like the rest of the app the
| HTML is public — the SPA checks the bearer token against the API and
| sends guests to /login.
|
*/

Route::get('/games/{path?}', fn () => view('games::app'))
    ->where('path', '.*')
    ->name('games');
