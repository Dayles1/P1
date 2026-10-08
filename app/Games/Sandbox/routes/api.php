<?php

use App\Games\Sandbox\Http\Controllers\LeaderboardController;
use App\Games\Sandbox\Http\Controllers\PlayerController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Sandbox — API (/api/sandbox/*)
|--------------------------------------------------------------------------
|
| Behind the host app's `auth.api` group: the player is whoever the
| bearer token belongs to.
|
*/

Route::middleware('auth.api')->group(function (): void {
    Route::get('player', [PlayerController::class, 'show'])->name('player.show');
    Route::put('player', [PlayerController::class, 'update'])->middleware('throttle:30,1')->name('player.update');
    Route::delete('player', [PlayerController::class, 'destroy'])->name('player.destroy');

    // For the games hub's card: the leaderboard and the player's progress.
    Route::get('leaderboard', [LeaderboardController::class, 'index'])->name('leaderboard');
    Route::get('summary', [LeaderboardController::class, 'summary'])->name('summary');
});
