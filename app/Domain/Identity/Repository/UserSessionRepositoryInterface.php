<?php

namespace App\Domain\Identity\Repository;

use App\Domain\Identity\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface UserSessionRepositoryInterface
{
    public function getUserSessions(User $user, array $filters = []): LengthAwarePaginator;

    public function revoke(User $user, int $sessionId): void;

    public function revokeOthers(User $user);
}