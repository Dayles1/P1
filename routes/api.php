<?php

use App\Http\Controllers\Api\AccessControl\RoleController;
use App\Http\Controllers\Api\Admin\FaviconController;
use App\Http\Controllers\Api\Admin\RequestLogController as AdminRequestLogController;
use App\Http\Controllers\Api\Admin\SessionController as AdminSessionController;
use App\Http\Controllers\Api\Admin\SettingController;
use App\Http\Controllers\Api\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\Auth\RequestLogController;
use App\Http\Controllers\Api\Auth\SessionController;
use App\Http\Controllers\Api\Chat\ConversationController;
use App\Http\Controllers\Api\Chat\MemberController;
use App\Http\Controllers\Api\Chat\MessageController;
use App\Http\Controllers\Api\Chat\TypingController;
use App\Http\Controllers\Api\Chat\UserSearchController;
use App\Http\Controllers\Api\Dashboard\DashboardController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\Profile\AvatarController;
use App\Http\Controllers\Api\Profile\ProfileController;
use App\Http\Controllers\Api\Profile\UserSettingController;
use App\Http\Controllers\Api\Setting\LanguageController;
use App\Http\Controllers\Api\Setting\TimezoneController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:login');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('login/verify', [AuthController::class, 'verifyLoginCode'])->middleware('throttle:verification-code');
    Route::post('login/code', [AuthController::class, 'requestLoginCode'])->middleware('throttle:verification-code');
    Route::post('login/code/verify', [AuthController::class, 'verifyLoginCodeLogin'])->middleware('throttle:verification-code');
    Route::post('login/code/resend', [AuthController::class, 'resendLoginCode'])->middleware('throttle:verification-code');
    Route::post('forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:login');
    Route::post('reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:login');

    Route::get('email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
        ->middleware(['signed', 'throttle:6,1'])
        ->name('verification.verify');

    Route::post('email/verification-notification', [AuthController::class, 'resendVerification'])
        ->middleware('throttle:6,1');

    // Not behind auth.api: a freshly registered user has no bearer token
    // yet, so this identifies the pending code via an opaque
    // challenge_token instead (same idiom as login/code/verify). Still
    // works for an already-authenticated caller, who is resolved from
    // the bearer token as usual and never needs a challenge_token.
    Route::post('email/verify-code', [AuthController::class, 'verifyEmailCode'])
        ->middleware('throttle:verification-code');

    Route::middleware('auth.api')->group(function (): void {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);

        Route::post('confirm-password', [AuthController::class, 'confirmPassword']);
    });
});

/*
|--------------------------------------------------------------------------
| Own sessions + their request logs (owner-only, enforced by UserSessionPolicy)
|--------------------------------------------------------------------------
*/
Route::middleware('auth.api')
    ->prefix('sessions')
    ->group(function () {
        Route::get('/', [SessionController::class, 'index']);
        Route::delete('/others', [SessionController::class, 'destroyOthers']);
        Route::get('/{session}', [SessionController::class, 'show']);
        Route::delete('/{session}', [SessionController::class, 'destroy']);

        Route::get('/{session}/request-logs', [RequestLogController::class, 'index']);
        Route::get('/{session}/request-logs/{requestLog}', [RequestLogController::class, 'show']);
    });

Route::middleware('auth.api')
    ->prefix('profile')
    ->controller(ProfileController::class)
    ->group(function () {
        Route::get('/', 'show');
        Route::patch('/', 'update');
    });
Route::prefix('profile')->middleware('auth.api')->group(function () {
    Route::get('avatars', [AvatarController::class, 'index']);
    Route::post('avatars', [AvatarController::class, 'store']);
    Route::delete('avatars/{avatar}', [AvatarController::class, 'destroy']);
});
Route::prefix('profile')
    ->middleware('auth.api')
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

Route::get('timezones', [TimezoneController::class, 'index']);
Route::get('languages', [LanguageController::class, 'index']);
Route::middleware('auth.api')->get('roles', [RoleController::class, 'index']);

Route::middleware('auth.api')->get('dashboard', [DashboardController::class, 'index']);

Route::middleware('auth.api')->prefix('notifications')->controller(NotificationController::class)->group(function () {
    Route::get('/', 'index');
    Route::get('unread-count', 'unreadCount');
    Route::post('read-all', 'markAllAsRead');
    Route::post('{notification}/read', 'markAsRead');
});

Route::middleware('auth.api')->prefix('conversations')->controller(ConversationController::class)->group(function () {
    Route::get('/', 'index');
    Route::post('/', 'store');
    Route::get('{conversation}', 'show');
    Route::patch('{conversation}', 'update');
    Route::delete('{conversation}', 'destroy');
    Route::post('{conversation}/pin', 'pin');
    Route::post('{conversation}/unpin', 'unpin');

});
Route::middleware('auth.api')->prefix('conversations')->controller(MemberController::class)->group(function () {
    Route::get('{conversation}/members', 'index');
    Route::post('{conversation}/members', 'store');
    Route::delete('{conversation}/members', 'destroy');
});
Route::middleware('auth.api')->prefix('conversations')->controller(MessageController::class)->group(function () {
    Route::get('{conversation}/messages', 'index');
    Route::post('{conversation}/messages', 'store');
    Route::get('{conversation}/messages/pinned', 'pinned');
    Route::patch('{conversation}/messages/{message}', 'update');
    Route::delete('{conversation}/messages/{message}', 'destroy');
    Route::post('{conversation}/messages/{message}/reactions', 'react');
    Route::post('{conversation}/messages/{message}/read', 'markRead');
    Route::post('{conversation}/messages/{message}/pin', 'pin');
    Route::delete('{conversation}/messages/{message}/pin', 'unpin');
});
Route::middleware('auth.api')->get('messages/search', [MessageController::class, 'search']);
Route::middleware('auth.api')->post('conversations/{conversation}/typing', [TypingController::class, 'store']);
Route::middleware('auth.api')->get('chat/users/search', [UserSearchController::class, 'index']);

/*
|--------------------------------------------------------------------------
| Admin — requires SUPER_ADMIN or ADMIN (role middleware, server-enforced)
|--------------------------------------------------------------------------
*/
Route::prefix('admin/settings')
    ->middleware(['auth.api', 'role:SUPER_ADMIN,ADMIN'])
    ->group(function () {
        Route::get('/', [SettingController::class, 'index']);
        Route::post('favicon', [FaviconController::class, 'store']);
        Route::delete('favicon', [FaviconController::class, 'destroy']);
        Route::get('{setting}', [SettingController::class, 'show']);
        Route::patch('{setting}', [SettingController::class, 'update']);
    });

Route::prefix('admin/sessions')
    ->middleware(['auth.api', 'role:SUPER_ADMIN,ADMIN'])
    ->group(function () {
        Route::get('/', [AdminSessionController::class, 'index']);
        Route::get('{session}', [AdminSessionController::class, 'show']);
        Route::delete('{session}', [AdminSessionController::class, 'destroy']);
        Route::get('{session}/request-logs', [AdminRequestLogController::class, 'bySession']);
    });

Route::prefix('admin/request-logs')
    ->middleware(['auth.api', 'role:SUPER_ADMIN,ADMIN'])
    ->group(function () {
        Route::get('/', [AdminRequestLogController::class, 'index']);
        Route::get('{requestLog}', [AdminRequestLogController::class, 'show']);
    });

Route::prefix('admin/users')
    ->middleware(['auth.api', 'role:SUPER_ADMIN,ADMIN'])
    ->group(function () {
        Route::get('/', [AdminUserController::class, 'index']);
        Route::get('{user}', [AdminUserController::class, 'show']);
        Route::patch('{user}/role', [AdminUserController::class, 'updateRole']);
        Route::post('{user}/ban', [AdminUserController::class, 'ban']);
        Route::delete('{user}/ban', [AdminUserController::class, 'unban']);
    });
