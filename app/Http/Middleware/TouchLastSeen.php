<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Updates `users.last_seen_at` off the back of ordinary authenticated API
 * traffic — no dedicated heartbeat endpoint needed. Throttled to at most
 * once a minute per user so an active session doesn't turn every request
 * into a write; runs in `terminate()` so it never adds request latency.
 */
class TouchLastSeen
{
    private const THROTTLE_SECONDS = 60;

    public function handle(Request $request, Closure $next): Response
    {
        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        $user = $request->user();

        if (! $user) {
            return;
        }

        if ($user->last_seen_at?->gt(now()->subSeconds(self::THROTTLE_SECONDS))) {
            return;
        }

        $user->forceFill(['last_seen_at' => now()])->saveQuietly();
    }
}
