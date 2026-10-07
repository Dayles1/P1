<?php

use App\Games\CityBuilder\Http\Controllers\CitySaveController;
use App\Games\Epochs\Http\Controllers\ContentController;
use App\Games\Epochs\Http\Controllers\WorldController;
use App\Games\Http\Controllers\GameHubController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Games — API (/api/games/*)
|--------------------------------------------------------------------------
|
| Behind the app's usual `auth.api` group: the player is whoever the
| bearer token belongs to.
|
*/

Route::middleware('auth.api')->group(function (): void {
    Route::get('progress', [GameHubController::class, 'progress'])->name('progress');

    Route::prefix('city')->name('city.')->group(function (): void {
        Route::get('save', [CitySaveController::class, 'show'])->name('save.show');
        Route::put('save', [CitySaveController::class, 'update'])->middleware('throttle:60,1')->name('save.update');
        Route::delete('save', [CitySaveController::class, 'destroy'])->name('save.destroy');
    });

    /*
     * "City of Eras": the content files (settings) and the player's world.
     * Writing content is the Workshop's job and is gated in the controller.
     */
    Route::prefix('epochs')->name('epochs.')->group(function (): void {
        Route::get('content', [ContentController::class, 'index'])->name('content.index');
        Route::put('content/{key}', [ContentController::class, 'update'])
            ->where('key', '[a-z]+(?:/[a-z0-9_]+)?')
            ->name('content.update');
        Route::delete('content/{key}', [ContentController::class, 'destroy'])
            ->where('key', '[a-z]+(?:/[a-z0-9_]+)?')
            ->name('content.destroy');

        Route::get('world', [WorldController::class, 'show'])->name('world.show');
        Route::post('world', [WorldController::class, 'store'])->middleware('throttle:10,1')->name('world.store');
        Route::put('world', [WorldController::class, 'sync'])->middleware('throttle:60,1')->name('world.sync');
        Route::delete('world', [WorldController::class, 'destroy'])->name('world.destroy');
    });
});
