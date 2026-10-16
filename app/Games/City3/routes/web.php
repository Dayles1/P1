<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Летопись города 3 — the page
|--------------------------------------------------------------------------
|
| One HTML shell; the game runs in the browser (client/). Like the rest
| of the app the HTML is public — the client checks the bearer token
| against the API and sends guests to /login.
|
*/

Route::get('/games/city3', fn () => view('city3::app'))->name('city3');
