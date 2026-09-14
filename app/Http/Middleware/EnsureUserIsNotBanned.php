<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A ban was previously only checked at login — an already-issued Sanctum
 * token kept working for every other endpoint for as long as it lived,
 * even after an admin banned the account. This closes that gap for every
 * `auth:sanctum` route in one place, regardless of which code path created
 * the ban.
 */
class EnsureUserIsNotBanned
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user?->isBanned()) {
            abort(403, __('auth.user_banned'));
        }

        return $next($request);
    }
}
