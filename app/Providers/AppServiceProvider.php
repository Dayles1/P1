<?php

namespace App\Providers;

use App\Domain\Setting\Services\SettingService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // One instance per request (and per queued job), so the settings
        // table is read once per request instead of once per formatted
        // date — see SettingService::all().
        $this->app->scoped(SettingService::class);
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

        $this->applyGlobalSettingOverrides();

        // Both notification classes already put conversation_id/message_id
        // into their `data` JSON (see MentionNotification/MessageNotification)
        // — mirror them into real columns on write so later queries (e.g.
        // "mark this conversation's notifications read") don't need a JSON
        // path lookup. Keeps SendMessage and the notification classes
        // untouched.
        DatabaseNotification::creating(function (DatabaseNotification $notification) {
            $notification->conversation_id = $notification->data['conversation_id'] ?? null;
            $notification->message_id = $notification->data['message_id'] ?? null;
        });
    }

    /**
     * A handful of admin Settings are meant to be the single source of
     * truth for values every other part of the app already reads via
     * config() — rather than touching every layout/notification that calls
     * config('app.name') etc., override the config value once here. Guarded
     * by Schema::hasTable() so a fresh install (before migrations run) or
     * `artisan migrate` itself never breaks on a missing settings table.
     *
     * system.timezone is deliberately NOT handled this way — see
     * UserDateFormatter::resolveTimezone(), which reads it directly instead,
     * because Laravel's LoadConfiguration bootstrapper already calls
     * date_default_timezone_set() from config('app.timezone') before any
     * service provider (including this one) boots, so overriding it this
     * late would silently do nothing for PHP's actual default timezone.
     */
    private function applyGlobalSettingOverrides(): void
    {
        if (! Schema::hasTable('settings')) {
            return;
        }

        $settings = app(SettingService::class);

        if ($siteName = $settings->string('system.site_name')) {
            config(['app.name' => $siteName]);
        }

        if ($fallbackLocale = $settings->string('localization.fallback_locale')) {
            config(['app.fallback_locale' => $fallbackLocale]);
        }
    }
}
