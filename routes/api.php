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
use App\Http\Controllers\Api\Chat\PollController;
use App\Http\Controllers\Api\Chat\TypingController;
use App\Http\Controllers\Api\Chat\UserSearchController;
use App\Http\Controllers\Api\Currency\CurrencyController;
use App\Http\Controllers\Api\Currency\ExchangeRateController;
use App\Http\Controllers\Api\Currency\FavoriteCurrencyController;
use App\Http\Controllers\Api\Dashboard\DashboardController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\Payment\CardController;
use App\Http\Controllers\Api\Payment\PaymentCallbackController;
use App\Http\Controllers\Api\Payment\PaymentController;
use App\Http\Controllers\Api\Profile\AvatarController;
use App\Http\Controllers\Api\Profile\ProfileController;
use App\Http\Controllers\Api\Profile\UserSettingController;
use App\Http\Controllers\Api\Setting\LanguageController;
use App\Http\Controllers\Api\Setting\TimezoneController;
use App\Http\Controllers\Api\User\UserBlockController;
use App\Http\Controllers\Api\User\UserDirectoryController;
use App\Http\Controllers\Api\User\UserReportController;
use App\Http\Controllers\Api\User\UserSharedController;
use App\Http\Controllers\Api\Wallet\WalletController;
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

/*
|--------------------------------------------------------------------------
| Currencies — reference data, same as timezones and languages above
|--------------------------------------------------------------------------
|
| Rates are quoted against the app currency and kept one row per day, so
| `?date=` asks what a rate was, not just what it is.
|
*/
Route::get('currencies', [CurrencyController::class, 'index']);
Route::get('currencies/convert', [CurrencyController::class, 'convert']);
Route::get('exchange-rates', [ExchangeRateController::class, 'index']);

Route::middleware('auth.api')
    ->prefix('profile')
    ->controller(FavoriteCurrencyController::class)
    ->group(function () {
        Route::get('favorite-currencies', 'index');
        Route::put('favorite-currencies', 'update');
    });
Route::middleware('auth.api')->get('roles', [RoleController::class, 'index']);

Route::middleware('auth.api')->get('dashboard', [DashboardController::class, 'index']);

Route::middleware('auth.api')->prefix('notifications')->controller(NotificationController::class)->group(function () {
    Route::get('/', 'index');
    Route::get('unread-count', 'unreadCount');
    Route::post('read-all', 'markAllAsRead');
    Route::post('{notification}/read', 'markAsRead');
});

/*
| Chat. Rate limits (`chat-*`) are defined in ConversationServiceProvider.
*/
Route::middleware('auth.api')->prefix('conversations')->controller(ConversationController::class)->group(function () {
    Route::get('/', 'index');
    Route::post('/', 'store');
    Route::get('unread', 'unread');
    Route::get('saved', 'saved');
    Route::get('{conversation}', 'show')->whereNumber('conversation');
    Route::get('{conversation}/summary', 'summary')->whereNumber('conversation');
    Route::patch('{conversation}', 'update')->whereNumber('conversation');
    Route::delete('{conversation}', 'destroy')->whereNumber('conversation');
    Route::post('{conversation}/avatar', 'storeAvatar')->whereNumber('conversation');
    Route::delete('{conversation}/avatar', 'destroyAvatar')->whereNumber('conversation');
    Route::patch('{conversation}/settings', 'settings')->whereNumber('conversation');
    Route::post('{conversation}/clear', 'clear')->whereNumber('conversation');
    Route::post('{conversation}/leave', 'leave')->whereNumber('conversation');
    Route::post('{conversation}/pin', 'pin')->whereNumber('conversation');
    Route::post('{conversation}/unpin', 'unpin')->whereNumber('conversation');
});
Route::middleware('auth.api')->prefix('conversations')->controller(MemberController::class)->group(function () {
    Route::get('{conversation}/members', 'index');
    Route::post('{conversation}/members', 'store');
    Route::delete('{conversation}/members', 'destroy');
    Route::patch('{conversation}/members/{user}', 'updateRole')->whereNumber('user');
    Route::post('{conversation}/transfer', 'transfer');
});
Route::middleware('auth.api')->prefix('conversations')->controller(MessageController::class)->group(function () {
    Route::get('{conversation}/messages', 'index');
    Route::post('{conversation}/messages', 'store')->middleware('throttle:chat-send');
    Route::get('{conversation}/messages/pinned', 'pinned');
    Route::post('{conversation}/messages/delete', 'destroyMany');
    Route::post('{conversation}/read', 'read');
    Route::patch('{conversation}/messages/{message}', 'update')->whereNumber('message');
    Route::delete('{conversation}/messages/{message}', 'destroy')->whereNumber('message');
    Route::get('{conversation}/messages/{message}/info', 'info')->whereNumber('message');
    Route::post('{conversation}/messages/{message}/reactions', 'react')->whereNumber('message')->middleware('throttle:chat-reactions');
    Route::post('{conversation}/messages/{message}/read', 'markRead')->whereNumber('message');
    Route::post('{conversation}/messages/{message}/pin', 'pin')->whereNumber('message');
    Route::delete('{conversation}/messages/{message}/pin', 'unpin')->whereNumber('message');
});
Route::middleware('auth.api')->prefix('conversations')->controller(PollController::class)->group(function () {
    Route::post('{conversation}/polls', 'store')->middleware('throttle:chat-send');
    Route::post('{conversation}/messages/{message}/vote', 'vote')->whereNumber('message');
    Route::delete('{conversation}/messages/{message}/vote', 'retract')->whereNumber('message');
    Route::post('{conversation}/messages/{message}/close', 'close')->whereNumber('message');
});
Route::middleware('auth.api')->get('messages/search', [MessageController::class, 'search'])->middleware('throttle:chat-search');
Route::middleware('auth.api')->post('messages/forward', [MessageController::class, 'forward'])->middleware('throttle:chat-send');
Route::middleware('auth.api')->post('conversations/{conversation}/typing', [TypingController::class, 'store'])->middleware('throttle:chat-typing');
Route::middleware('auth.api')->get('chat/users/search', [UserSearchController::class, 'index'])->middleware('throttle:chat-search');
Route::middleware('auth.api')->prefix('users')->controller(UserBlockController::class)->group(function () {
    Route::get('blocked', 'index');
    Route::post('{user}/block', 'store')->whereNumber('user');
    Route::delete('{user}/block', 'destroy')->whereNumber('user');
});

/*
| People directory and public profiles — banned accounts are visible to a
| super admin only.
*/
Route::middleware('auth.api')->prefix('users')->controller(UserDirectoryController::class)->group(function () {
    Route::get('/', 'index');
    Route::get('{user}', 'show')->whereNumber('user');
});
Route::middleware('auth.api')->prefix('users')->group(function () {
    Route::get('{user}/shared', [UserSharedController::class, 'index'])->whereNumber('user');
    Route::post('{user}/report', [UserReportController::class, 'store'])->whereNumber('user')->middleware('throttle:10,1');
});

/*
|--------------------------------------------------------------------------
| Wallets, payments and saved cards (the caller's own)
|--------------------------------------------------------------------------
|
| Every payment — a top-up, or paying for something — is a Payment; the
| wallet ledger records what moved the balance.
|
*/
Route::middleware('auth.api')->prefix('wallets')->controller(WalletController::class)->group(function () {
    Route::get('/', 'index');
    Route::post('top-up', 'topUp');
    Route::get('{wallet}/transactions', 'transactions')->whereNumber('wallet');
});

Route::middleware('auth.api')->prefix('payments')->controller(PaymentController::class)->group(function () {
    Route::get('/', 'index');
    Route::get('{payment}', 'show')->whereUuid('payment');
});

Route::middleware('auth.api')->prefix('cards')->controller(CardController::class)->group(function () {
    Route::get('/', 'index');
    Route::post('/', 'store')->middleware('throttle:10,1');
    Route::post('{card}/verify', 'verify')->whereNumber('card')->middleware('throttle:verification-code');
    Route::delete('{card}', 'destroy')->whereNumber('card');
});

/*
| Provider callbacks — no user auth; each gateway verifies its provider's
| signature or credentials itself.
*/
Route::post('payments/callback/{provider}', PaymentCallbackController::class)
    ->name('payments.callback');

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
