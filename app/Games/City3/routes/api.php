<?php

use App\Games\City3\Http\Controllers\LeaderboardController;
use App\Games\City3\Http\Controllers\PlayerController;
use App\Games\City3\Http\Controllers\WorldController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Летопись города 3 — API (/api/city3/*)
|--------------------------------------------------------------------------
|
| Behind the host app's `auth.api` group: the player is whoever the
| bearer token belongs to.
|
*/

Route::middleware('auth.api')->group(function (): void {
    Route::get('world', [WorldController::class, 'show'])->name('world.show');
    // Each limit counts on its own (the third throttle argument is the
    // counter's prefix), so autosaves never use up world creation or the
    // hub's playtime beat, which share the default unprefixed counter.
    Route::post('world', [WorldController::class, 'store'])->middleware('throttle:10,1,city3-create')->name('world.store');
    // Autosaves come every 20 s of play and on pausing: 60 a minute is plenty.
    Route::put('world', [WorldController::class, 'sync'])->middleware('throttle:60,1,city3-sync')->name('world.sync');
    Route::delete('world', [WorldController::class, 'destroy'])->name('world.destroy');

    // For the games hub's card: the leaderboard, the player's progress and its reset.
    Route::get('leaderboard', [LeaderboardController::class, 'index'])->name('leaderboard');
    Route::get('summary', [LeaderboardController::class, 'summary'])->name('summary');
    Route::delete('player', [PlayerController::class, 'destroy'])->name('player.destroy');
});
