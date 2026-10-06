<?php

namespace App\Domain\Dashboard\Actions;

use App\Domain\AccessControl\Models\Role;
use App\Domain\Identity\Models\RequestLog;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSession;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class GetDashboardSummary
{
    /**
     * Every number here comes straight from the database for the
     * authenticated user (and, for admins, the whole instance) — nothing is
     * fabricated for display purposes.
     *
     * @return array<string, mixed>
     */
    public function handle(User $user): array
    {
        $dayAgo = now()->subDay();
        $twoDaysAgo = now()->subDays(2);
        $weekAgo = now()->subDays(7);

        $userRequests = fn () => RequestLog::query()->where('user_id', $user->id);
        $userSessions = fn () => UserSession::query()->where('user_id', $user->id);

        $latestSession = $userSessions()->latest('logged_in_at')->first();

        $summary = [
            'account' => [
                'created_at' => $user->created_at,
                'email_verified' => $user->email_verified_at !== null,
                'has_avatar' => $user->avatar()->exists(),
                'has_timezone_set' => $user->settings?->timezone_id !== null,
                'has_two_factor' => (bool) $user->settings?->require_login_verification,
                'profile_completeness' => $this->profileCompleteness($user),
            ],

            'sessions' => [
                'total' => $userSessions()->count(),
                'active' => $userSessions()->whereNull('logged_out_at')->count(),
                'new_this_week' => $userSessions()->where('logged_in_at', '>=', $weekAgo)->count(),
                'devices' => $userSessions()
                    ->select(['browser', 'platform', 'device_name'])
                    ->distinct()
                    ->get()
                    ->count(),
                'latest_device' => $latestSession
                    ? ($latestSession->device_name ?: $latestSession->platform ?: $latestSession->browser)
                    : null,
            ],

            'requests' => [
                'today' => $userRequests()->whereDate('created_at', today())->count(),
                'this_week' => $userRequests()->where('created_at', '>=', $weekAgo)->count(),
                'errors_this_week' => $userRequests()
                    ->where('created_at', '>=', $weekAgo)
                    ->where('status_code', '>=', 400)
                    ->count(),
                'last_24h' => $userRequests()->where('created_at', '>=', $dayAgo)->count(),
                'previous_24h' => $userRequests()
                    ->where('created_at', '>=', $twoDaysAgo)
                    ->where('created_at', '<', $dayAgo)
                    ->count(),
                'errors_24h' => $userRequests()
                    ->where('created_at', '>=', $dayAgo)
                    ->where('status_code', '>=', 400)
                    ->count(),
                'top_error_status' => $userRequests()
                    ->where('created_at', '>=', $dayAgo)
                    ->where('status_code', '>=', 400)
                    ->groupBy('status_code')
                    ->orderByRaw('count(*) desc')
                    ->value('status_code'),
            ],

            'conversations' => [
                'total' => $user->conversations()->count(),
                'with_unread' => $user->conversations()->where('conversation_users.unread_count', '>', 0)->count(),
            ],

            'unread_messages' => (int) $user->conversations()->sum('conversation_users.unread_count'),
            'unread_notifications' => $user->unreadNotifications()->count(),
            'unread_notifications_today' => $user->unreadNotifications()->whereDate('created_at', today())->count(),

            'recent_sessions' => $userSessions()
                ->latest('last_activity_at')
                ->limit(5)
                ->get(),

            'recent_requests' => $userRequests()
                ->latest('created_at')
                ->limit(8)
                ->get(),

            'recent_conversations' => $user->conversations()
                ->with(['users:id,name', 'users.avatar', 'lastMessage.user:id,name'])
                ->withPivot(['unread_count'])
                ->orderByDesc('last_message_at')
                ->limit(5)
                ->get(),
        ];

        if ($user->hasRole(Role::SUPER_ADMIN) || $user->hasRole(Role::ADMIN)) {
            $summary['instance'] = $this->instance();
        }

        return $summary;
    }

    /**
     * The whole instance at a glance, for admins.
     *
     * @return array<string, mixed>
     */
    private function instance(): array
    {
        $dayAgo = now()->subDay();
        $totalUsers = User::query()->count();
        $requests24h = RequestLog::query()->where('created_at', '>=', $dayAgo)->count();
        $release = collect(require base_path('resources/data/changelog.php'))->first();

        return [
            'total_users' => $totalUsers,
            'users_this_month' => User::query()->where('created_at', '>=', now()->subMonth())->count(),
            'active_today' => User::query()->where('last_seen_at', '>=', today())->count(),
            'active_sessions' => UserSession::query()->whereNull('logged_out_at')->count(),
            'requests_today' => RequestLog::query()->whereDate('created_at', today())->count(),
            'errors_today' => RequestLog::query()->whereDate('created_at', today())->where('status_code', '>=', 400)->count(),
            'requests_last_minute' => RequestLog::query()->where('created_at', '>=', now()->subMinute())->count(),
            'requests_peak_per_minute' => $this->peakPerMinute(),
            'requests_24h' => $requests24h,
            'server_errors_24h' => RequestLog::query()->where('created_at', '>=', $dayAgo)->where('status_code', '>=', 500)->count(),
            'queue_pending' => $this->countIfTable('jobs'),
            'queue_failed' => $this->countIfTable('failed_jobs'),
            'version' => $release['version'] ?? null,
            'released_at' => $release['date'] ?? null,
            'services' => [
                'reverb' => $this->reverbIsUp(),
                'queue' => $this->countIfTable('failed_jobs') === 0,
                'mail' => config('mail.default') !== null && config('mail.default') !== 'log' && config('mail.default') !== 'array',
                'database' => true,
            ],
        ];
    }

    /**
     * The most requests the instance served in one minute over the last
     * day. The minute is the first 16 characters of the stored timestamp
     * ("2026-09-26 10:42"), which reads the same on MySQL and SQLite.
     */
    private function peakPerMinute(): int
    {
        return (int) DB::query()
            ->fromSub(
                RequestLog::query()
                    ->where('created_at', '>=', now()->subDay())
                    ->selectRaw('substr(created_at, 1, 16) as minute, count(*) as total')
                    ->groupBy('minute'),
                'per_minute',
            )
            ->max('total');
    }

    private function countIfTable(string $table): ?int
    {
        return Schema::hasTable($table) ? DB::table($table)->count() : null;
    }

    /**
     * Whether the Reverb server answers on its port — a quick connect, not
     * a broadcast, so a stopped server costs a fraction of a second.
     */
    private function reverbIsUp(): bool
    {
        if (config('broadcasting.default') !== 'reverb') {
            return false;
        }

        $host = (string) config('broadcasting.connections.reverb.options.host');
        $port = (int) config('broadcasting.connections.reverb.options.port');

        if ($host === '' || $port === 0) {
            return false;
        }

        try {
            $socket = @fsockopen($host, $port, $errorCode, $errorMessage, 0.3);
        } catch (Throwable) {
            return false;
        }

        if ($socket === false) {
            return false;
        }

        fclose($socket);

        return true;
    }

    private function profileCompleteness(User $user): int
    {
        $checks = [
            $user->name !== '',
            $user->email_verified_at !== null,
            $user->avatar()->exists(),
            $user->settings?->timezone_id !== null,
        ];

        $done = count(array_filter($checks));

        return (int) round(($done / count($checks)) * 100);
    }
}
