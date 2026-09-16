<?php

namespace App\Providers;

use App\Domain\Setting\Services\SettingService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Keyed by email+IP (not just IP) so one attacker can't lock out a
        // victim's account by hammering it from many IPs, and one shared
        // office IP can't lock every account behind it out from a single
        // user's mistyped password. Reuses the existing (previously
        // unenforced) admin-configurable auth.max_login_attempts /
        // auth.lockout_minutes settings instead of a separate hardcoded
        // limit, so the Settings UI's numbers finally mean something.
        RateLimiter::for('login', function (Request $request) {
            $settings = app(SettingService::class);
            $max = max(1, $settings->integer('auth.max_login_attempts', 5));
            $minutes = max(1, $settings->integer('auth.lockout_minutes', 15));
            $key = Str::lower((string) $request->input('email')).'|'.$request->ip();

            return Limit::perMinutes($minutes, $max)->by($key);
        });

        // Verification-code endpoints (login 2FA, passwordless login,
        // email verification-by-code) are a separate, tighter limit —
        // these guard a short numeric code rather than a password, so a
        // brute-force attempt needs far fewer tries to matter.
        RateLimiter::for('verification-code', function (Request $request) {
            $key = Str::lower((string) ($request->input('email') ?? $request->input('challenge_token')))
                .'|'.$request->ip();

            return Limit::perMinute(5)->by($key);
        });
    }
}
