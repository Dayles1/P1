<?php

use App\Http\Controllers\Web\Blade\AuthPageController;
use App\Http\Controllers\Web\Blade\SettingsPageController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Home
|--------------------------------------------------------------------------
*/

Route::get('/', function () {
    return view('blade.pages.home');
})->name('home');

Route::get('/about', function () {
    return view('blade.pages.about');
})->name('about');

Route::get('/contact', function () {
    return view('blade.pages.contact');
})->name('contact');

/*
|--------------------------------------------------------------------------
| Authentication SPA
|--------------------------------------------------------------------------
|
| Все auth-страницы возвращают ОДИН Blade SPA.
|
| JS уже решает, какой компонент показать.
|
|--------------------------------------------------------------------------
*/

Route::controller(AuthPageController::class)->group(function () {

    Route::get('/login', 'index')
        ->name('login');

    Route::get('/login/code', 'index')
        ->name('login.code');

    Route::get('/register', 'index')
        ->name('register');

    Route::get('/forgot-password', 'index')
        ->name('password.request');

    Route::get('/reset-password/{token}', 'index')
        ->name('password.reset');

    Route::get('/verify-email', 'index')
        ->name('verification.notice');

    Route::get('/confirm-password', 'index')
        ->name('password.confirm');
});

/*
|--------------------------------------------------------------------------
| Authenticated area
|--------------------------------------------------------------------------
|
| These pages require a valid Sanctum bearer token, but that can only
| be verified client-side (there is no server session for API logins),
| so there is no server-side auth middleware here — each page's own JS
| checks GET /api/auth/me on load and redirects to /login if it fails.
|
*/

Route::get('/dashboard', function () {
    return view('blade.pages.dashboard');
})->name('dashboard');

/*
 * Profile now lives inside Settings (Personal -> Profile), same
 * retirement pattern as /admin/settings below — old bookmarks/links to
 * /profile still land somewhere sensible.
 */
Route::get('/profile', function () {
    return redirect()->route('settings.profile');
})->name('profile');

Route::get('/sessions', function () {
    return view('blade.pages.sessions');
})->name('sessions');

Route::get('/sessions/{session}', function (string $session) {
    return view('blade.pages.session-detail');
})->name('sessions.show');

/*
|--------------------------------------------------------------------------
| Settings
|--------------------------------------------------------------------------
|
| One real route per section instead of one page with a `#hash` router.
| The two groups live in two URL spaces on purpose: /settings/* is what a
| user changes about themselves, /admin/settings/* is instance-wide
| configuration (see the Admin area below).
|
| `defaults()` hands the controller the section it was registered for —
| the segment is baked into the URL, so it is not a route parameter the
| caller can pass, and every section still gets its own route name
| (`settings.appearance`, `admin.settings.system`, ...).
|
*/

Route::get('/settings', [SettingsPageController::class, 'index'])->name('settings');

foreach (array_keys(SettingsPageController::PERSONAL) as $segment) {
    Route::get("/settings/{$segment}", [SettingsPageController::class, 'personal'])
        ->defaults('section', $segment)
        ->name("settings.{$segment}");
}

Route::get('/notifications', function () {
    return view('blade.pages.notifications');
})->name('notifications');

Route::get('/changelog', function () {
    return view('blade.pages.changelog', ['releases' => require base_path('resources/data/changelog.php')]);
})->name('changelog');

Route::get('/chat', function () {
    return view('blade.pages.chat');
})->name('chat');

Route::get('/chat/{conversation}', function (string $conversation) {
    return view('blade.pages.chat');
})->name('chat.show');

/*
|--------------------------------------------------------------------------
| Admin area
|--------------------------------------------------------------------------
*/

/*
 * Application settings: one route per section, same shell as the
 * personal ones but their own URL space — and, because it is its own
 * space, its own secondary sidebar: /settings never lists Application
 * sections and /admin/settings never lists personal ones.
 *
 * /admin/settings is the group's index, the same page /settings is for
 * the personal group (nav on a phone, first section on a desktop), which
 * is also where "back" out of a section lands.
 */
Route::get('/admin/settings', [SettingsPageController::class, 'applicationIndex'])
    ->name('admin.settings');

foreach (array_keys(SettingsPageController::APPLICATION) as $segment) {
    Route::get("/admin/settings/{$segment}", [SettingsPageController::class, 'application'])
        ->defaults('section', $segment)
        ->name("admin.settings.{$segment}");
}

Route::get('/admin/users', function () {
    return view('blade.pages.admin.users');
})->name('admin.users');

Route::get('/admin/sessions', function () {
    return view('blade.pages.admin.sessions');
})->name('admin.sessions');

Route::get('/admin/sessions/{session}', function (string $session) {
    return view('blade.pages.admin.session-detail');
})->name('admin.sessions.show');

Route::get('/admin/request-logs', function () {
    return view('blade.pages.admin.request-logs');
})->name('admin.request-logs');
