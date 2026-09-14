<?php

namespace App\Domain\Dashboard\Actions;

use App\Domain\AccessControl\Models\Role;
use App\Domain\Identity\Models\RequestLog;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSession;

class GetDashboardSummary
{
    /**
     * Every number here comes straight from the database for the
     * authenticated user (and, for admins, the whole instance) — nothing is
     * fabricated for display purposes.
     */
    public function handle(User $user): array
    {
        $summary = [
            'account' => [
                'created_at' => $user->created_at,
                'email_verified' => $user->email_verified_at !== null,
                'has_avatar' => $user->avatar()->exists(),
                'has_timezone_set' => $user->settings?->timezone_id !== null,
                'profile_completeness' => $this->profileCompleteness($user),
            ],

            'sessions' => [
                'total' => UserSession::query()->where('user_id', $user->id)->count(),
                'active' => UserSession::query()->where('user_id', $user->id)->whereNull('logged_out_at')->count(),
            ],

            'requests' => [
                'today' => RequestLog::query()->where('user_id', $user->id)->whereDate('created_at', today())->count(),
                'this_week' => RequestLog::query()->where('user_id', $user->id)->where('created_at', '>=', now()->subDays(7))->count(),
                'errors_this_week' => RequestLog::query()->where('user_id', $user->id)
                    ->where('created_at', '>=', now()->subDays(7))
                    ->where('status_code', '>=', 400)
                    ->count(),
            ],

            'unread_messages' => (int) $user->conversations()->sum('conversation_users.unread_count'),

            'recent_sessions' => UserSession::query()
                ->where('user_id', $user->id)
                ->latest('last_activity_at')
                ->limit(5)
                ->get(),

            'recent_requests' => RequestLog::query()
                ->where('user_id', $user->id)
                ->latest('created_at')
                ->limit(8)
                ->get(),
        ];

        if ($user->hasRole(Role::SUPER_ADMIN) || $user->hasRole(Role::ADMIN)) {
            $summary['instance'] = [
                'total_users' => User::query()->count(),
                'active_sessions' => UserSession::query()->whereNull('logged_out_at')->count(),
                'requests_today' => RequestLog::query()->whereDate('created_at', today())->count(),
                'errors_today' => RequestLog::query()->whereDate('created_at', today())->where('status_code', '>=', 400)->count(),
            ];
        }

        return $summary;
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
