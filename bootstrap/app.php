<?php

use App\Http\Middleware\EnsureUserHasRole;
use App\Http\Middleware\EnsureUserIsNotBanned;
use App\Http\Middleware\LogApiRequest;
use App\Http\Middleware\SetLocale;
use App\Http\Middleware\TouchLastSeen;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    // Registered separately (rather than via withRouting's `channels:`
    // param) so /broadcasting/auth uses the same bearer-token guard as
    // every other API route — this app has no server session, so the
    // default `web` guard Broadcast::routes() would otherwise use could
    // never authorize a private/presence channel subscription.
    ->withBroadcasting(
        __DIR__.'/../routes/channels.php',
        ['middleware' => ['auth.api']],
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // The `locale` cookie is written in plaintext by client-side JS
        // (document.cookie, not Laravel's Cookie facade), so it's never
        // actually encrypted — left off this list, EncryptCookies tries to
        // decrypt it on every request, fails, and silently nulls it out.
        // SetLocale then falls straight through to Accept-Language browser
        // detection, which is why picking a language never stuck: whatever
        // the browser's own language was always won instead.
        $middleware->encryptCookies(except: ['locale']);

        $middleware->web(append: [
            AddLinkHeadersForPreloadedAssets::class,
            SetLocale::class,
        ]);

        $middleware->api(append: [
            SetLocale::class,
            LogApiRequest::class,
        ]);

        $middleware->alias([
            'role' => EnsureUserHasRole::class,
        ]);

        // Every authenticated API route uses this instead of bare
        // 'auth:sanctum', so a ban takes effect on the token's very next
        // request instead of only being checked at login.
        $middleware->group('auth.api', [
            'auth:sanctum',
            EnsureUserIsNotBanned::class,
            TouchLastSeen::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
