<?php

namespace App\Http\Middleware;

use App\Domain\Identity\Models\RequestLog;
use App\Domain\Identity\Models\UserSession;
use App\Infrastructure\Logging\RequestLogSanitizer;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Persists a redacted record of every API request/response into
 * `request_logs`, tied to the caller's `UserSession` when one can be
 * resolved. Runs its DB write in `terminate()` (after the response has
 * already been sent) so logging never adds latency to the request, and so
 * `$request->user()` — resolved by `auth:sanctum` deeper in the pipeline —
 * is guaranteed to be available by the time we read it.
 */
class LogApiRequest
{
    /**
     * Laravel resolves a fresh middleware instance for `terminate()` than
     * the one whose `handle()` ran — the container does not guarantee reuse
     * across the two calls — so request-scoped state (the start time) has
     * to live on the `$request` itself, not on `$this`.
     */
    private const STARTED_AT_ATTRIBUTE = '_request_log_started_at';

    public function __construct(
        private readonly RequestLogSanitizer $sanitizer,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $request->attributes->set(self::STARTED_AT_ATTRIBUTE, microtime(true));

        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        if (! config('request-logging.enabled', true) || $this->isExcluded($request)) {
            return;
        }

        $user = $request->user();
        $tokenId = $user?->currentAccessToken()?->id;
        $withoutContent = $this->matches($request, 'request-logging.body_excluded_paths');

        $userSessionId = $tokenId
            ? UserSession::query()->where('personal_access_token_id', $tokenId)->value('id')
            : null;

        // Excludes whichever top-level fields actually carry uploaded files
        // on *this* request, rather than a hardcoded ['file', 'files'] list
        // — an UploadedFile can't be JSON-encoded, and previously any new
        // upload field with a different name (e.g. chat's `attachments`)
        // would reach RequestLog::create() unsanitized and throw.
        [$body, $bodyTruncated] = $withoutContent ? [null, false] : $this->sanitizer->capture(
            $this->sanitizer->sanitizeFields($request->except(array_keys($request->allFiles())))
        );

        [$responseBody, $responseTruncated] = $withoutContent ? [null, false] : $this->sanitizer->capture(
            $this->sanitizer->sanitizeFields($this->decodeResponse($response))
        );

        RequestLog::query()->create([
            'user_session_id' => $userSessionId,
            'user_id' => $user?->id,
            'method' => $request->method(),
            'path' => '/'.ltrim($request->path(), '/'),
            'route_name' => $request->route()?->getName(),
            'status_code' => $response->getStatusCode(),
            'query' => $withoutContent ? null : ($this->sanitizer->sanitizeFields($request->query()) ?: null),
            'headers' => $this->sanitizer->sanitizeHeaders($request->headers->all()),
            'body' => $body ?: null,
            'body_truncated' => $bodyTruncated,
            'response_headers' => $this->sanitizer->sanitizeHeaders($response->headers->all()),
            'response_body' => $responseBody ?: null,
            'response_truncated' => $responseTruncated,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'duration_ms' => $this->durationMs($request),
            'created_at' => now(),
        ]);
    }

    private function durationMs(Request $request): ?int
    {
        $startedAt = $request->attributes->get(self::STARTED_AT_ATTRIBUTE);

        if (! is_float($startedAt)) {
            return null;
        }

        return (int) round((microtime(true) - $startedAt) * 1000);
    }

    private function isExcluded(Request $request): bool
    {
        return $this->matches($request, 'request-logging.excluded_paths');
    }

    /**
     * Whether the request path matches one of the patterns in the config list `$key`.
     */
    private function matches(Request $request, string $key): bool
    {
        foreach (config($key, []) as $pattern) {
            if ($request->is(ltrim($pattern, '/'))) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array<array-key, mixed>
     */
    private function decodeResponse(Response $response): array
    {
        if (! $response instanceof JsonResponse) {
            return [];
        }

        $decoded = json_decode($response->getContent() ?: '', true);

        return is_array($decoded) ? $decoded : [];
    }
}
