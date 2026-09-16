<?php

namespace App\Http\Middleware;

use App\Domain\Localization\Models\Language;
use App\Domain\Setting\Services\SettingService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the request locale for every response — API JSON messages
 * (`__('messages.*')`) and validation errors included. There is no server
 * session driving this (bearer-token API), so the order of precedence is:
 *
 *  1. The authenticated user's saved `user_settings.locale`.
 *  2. The `X-Locale` header the frontend sends on every XHR request once a
 *     language has been picked.
 *  3. The `locale` cookie the frontend writes on every locale switch — the
 *     only one of these that also reaches a plain (non-XHR) page load,
 *     since a normal navigation can't carry a custom header.
 *  4. The browser's `Accept-Language` header.
 *  5. The `localization.default_locale` app setting.
 */
class SetLocale
{
    public function handle(Request $request, Closure $next): Response
    {
        app()->setLocale($this->resolveLocale($request));

        return $next($request);
    }

    private function resolveLocale(Request $request): string
    {
        $supported = $this->supportedLocales();

        $user = $request->user();

        if ($user?->settings?->locale && in_array($user->settings->locale, $supported, true)) {
            return $user->settings->locale;
        }

        $header = $request->header('X-Locale');

        if ($header && in_array($header, $supported, true)) {
            return $header;
        }

        $cookie = $request->cookie('locale');

        if ($cookie && in_array($cookie, $supported, true)) {
            return $cookie;
        }

        $settings = app(SettingService::class);

        // Symfony's getPreferredLanguage() falls back to $supported[0] when
        // the Accept-Language header is simply absent (not just non-
        // matching) — extremely common for non-browser clients — which
        // would otherwise make the setting-based default below unreachable.
        // Gating this on the (previously dormant) auto_detect setting also
        // gives admins an explicit way to disable browser-based detection
        // entirely and always fall through to the configured default.
        if ($request->headers->has('Accept-Language') && $settings->boolean('localization.auto_detect_browser_locale', true)) {
            $preferred = $request->getPreferredLanguage($supported);

            if ($preferred) {
                return $preferred;
            }
        }

        $default = $settings->string('localization.default_locale', config('app.locale'));

        return in_array($default, $supported, true) ? $default : config('app.locale');
    }

    /**
     * @return list<string>
     */
    private function supportedLocales(): array
    {
        try {
            $codes = array_values(array_map(
                static fn (mixed $code): string => (string) $code,
                Language::query()->where('is_active', true)->pluck('code')->all()
            ));
        } catch (\Throwable) {
            // Table not migrated yet (fresh install, test harness without a
            // migrated DB, etc.) — never let locale resolution 500 a page.
            return ['en', 'ru', 'uz'];
        }

        return $codes !== [] ? $codes : ['en', 'ru', 'uz'];
    }
}
