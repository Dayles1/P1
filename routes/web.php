<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Web\Blade\AuthPageController;


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

Route::get('/profile', function () {
    return view('blade.pages.profile');
})->name('profile');

Route::get('/sessions', function () {
    return view('blade.pages.sessions');
})->name('sessions');

Route::get('/settings', function () {
    return view('blade.pages.settings');
})->name('settings');

Route::get('/admin/settings', function () {
    return view('blade.pages.admin.settings');
})->name('admin.settings');