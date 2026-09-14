<?php

namespace App\Infrastructure\Persistence\Eloquent\Session;

use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSession;
use App\Domain\Identity\Repository\UserSessionRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class UserSessionRepository implements UserSessionRepositoryInterface
{
    public function getUserSessions(User $user, array $filters = []): LengthAwarePaginator
    {
        $query = $user->sessions()
            ->with(['token'])
            ->latest('last_activity_at');

        match ($filters['status'] ?? 'all') {
            'active' => $query->whereNull('logged_out_at'),
            'expired' => $query->whereNotNull('logged_out_at'),
            default => null,
        };

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function revoke(User $user, int $sessionId): void
    {
        DB::transaction(function () use ($user, $sessionId) {
            $session = UserSession::query()
                ->where('user_id', $user->id)
                ->whereKey($sessionId)
                ->firstOrFail();

            if ($session->logged_out_at !== null) {
                return;
            }

            $session->update([
                'logged_out_at' => now(),
            ]);

            $session->token()?->delete();
        });
    }

    public function revokeOthers(User $user)
    {
        return DB::transaction(function () use ($user) {
            $currentTokenId = $user->currentAccessToken()?->id;

            $sessions = UserSession::query()
                ->where('user_id', $user->id)
                ->whereNull('logged_out_at')
                ->when($currentTokenId, fn ($query) => $query->where(
                    'personal_access_token_id',
                    '!=',
                    $currentTokenId
                ))
                ->get();

            if ($sessions->isEmpty()) {
                return 0;
            }

            foreach ($sessions as $session) {
                $session->update([
                    'logged_out_at' => now(),
                ]);

                $session->token()?->delete();
            }

            return $sessions->count();
        });
    }

    public function all(array $filters = []): LengthAwarePaginator
    {
        $query = UserSession::query()
            ->with(['user:id,name,email'])
            ->latest('last_activity_at');

        match ($filters['status'] ?? 'all') {
            'active' => $query->whereNull('logged_out_at'),
            'expired' => $query->whereNotNull('logged_out_at'),
            default => null,
        };

        if (! empty($filters['user_id'])) {
            $query->where('user_id', (int) $filters['user_id']);
        }

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('ip_address', 'like', "%{$search}%")
                    ->orWhere('device_name', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($userQuery) use ($search) {
                        $userQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function revokeAny(UserSession $session): void
    {
        DB::transaction(function () use ($session) {
            if ($session->logged_out_at !== null) {
                return;
            }

            $session->update([
                'logged_out_at' => now(),
            ]);

            $session->token()?->delete();
        });
    }
}
