<?php

namespace App\Domain\Identity\Repository;

use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSession;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface UserSessionRepositoryInterface
{
    public function getUserSessions(User $user, array $filters = []): LengthAwarePaginator;

    public function revoke(User $user, int $sessionId): void;

    public function revokeOthers(User $user);

    /**
     * All sessions across every user — admin oversight only.
     */
    public function all(array $filters = []): LengthAwarePaginator;

    public function revokeAny(UserSession $session): void;
}
