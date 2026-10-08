<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Sandbox — the page
|--------------------------------------------------------------------------
|
| One HTML shell; the game runs in the browser (client/). Like the rest
| of the app the HTML is public — the client checks the bearer token
| against the API and sends guests to /login.
|
*/

Route::get('/games/sandbox', fn () => view('sandbox::app'))->name('sandbox');
