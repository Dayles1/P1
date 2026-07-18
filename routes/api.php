<?php

use App\Http\Controllers\Api\Admin\SettingController;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\Auth\SessionController;
use App\Http\Controllers\Api\Chat\ConversationController;
use App\Http\Controllers\Api\Chat\MemberController;
use App\Http\Controllers\Api\Profile\AvatarController;
use App\Http\Controllers\Api\Profile\UserSettingController;
use App\Http\Controllers\Api\Setting\TimezoneController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login', [AuthController::class, 'login']);
    Route::post('forgot-password', [AuthController::class, 'forgotPassword']);
    Route::post('reset-password', [AuthController::class, 'resetPassword']);

    Route::get('email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
        ->middleware(['signed', 'throttle:6,1'])
        ->name('verification.verify');

    Route::post('email/verification-notification', [AuthController::class, 'resendVerification'])
        ->middleware('throttle:6,1');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);
    });
});


Route::prefix('admin/settings')
    ->middleware(['auth:sanctum',])
    ->group(function () {
        Route::get('/', [SettingController::class, 'index']);
        Route::get('{setting}', [SettingController::class, 'show']);
        Route::patch('{setting}', [SettingController::class, 'update']);
    });

Route::middleware('auth:sanctum')
    ->prefix('sessions')
    ->controller(SessionController::class)
    ->group(function () {
        Route::get('/', 'index');
        Route::delete('/others', 'destroyOthers');
        Route::delete('/{session}', 'destroy');
    });

Route::middleware('auth:sanctum')
    ->prefix('profile')
    ->controller(\App\Http\Controllers\Api\Profile\ProfileController::class)
    ->group(function () {
        Route::get('/', 'show');
        Route::patch('/', 'update');
    });
Route::prefix('profile')->middleware('auth:sanctum')->group(function () {
    Route::get('avatars', [AvatarController::class, 'index']);
    Route::post('avatars', [AvatarController::class, 'store']);
    Route::delete('avatars/{avatar}', [AvatarController::class, 'destroy']);
});
Route::prefix('profile')
    ->middleware('auth:sanctum')
    ->group(function () {

        Route::get(
            'settings',
            [UserSettingController::class, 'show']
        );

        Route::put(
            'settings',
            [UserSettingController::class, 'update']
        );
    });
Route::get(
    'timezones',
    [TimezoneController::class, 'index']
);

Route::middleware('auth:sanctum')->prefix('conversations')->controller(ConversationController::class)->group(function () {
    Route::get('/', 'index');
    Route::post('/', 'store');
    Route::get('{conversation}', 'show');
    Route::patch('{conversation}', 'update');
    Route::delete('{conversation}', 'destroy');
    Route::post('{conversation}/pin', 'pin');
    Route::post('{conversation}/unpin', 'unpin');

});
Route::middleware('auth:sanctum')->prefix('conversations')->controller(MemberController::class)->group(function () {
    Route::get('{conversation}/members', 'index');
    Route::post('{conversation}/members', 'store');
    Route::delete('{conversation}/members', 'destroy');
});

