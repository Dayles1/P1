<?php

namespace App\Domain\Identity\Actions\Session;

use App\Domain\Identity\Models\User;
use App\Domain\Identity\Repository\UserSessionRepositoryInterface;

class RevokeSession
{
    public function __construct(
        protected UserSessionRepositoryInterface $sessionRepository,
    ) {
    }

    public function handle(User $user, string|int $sessionId): void
    {
        $this->sessionRepository->revoke($user, (int) $sessionId);
    }
}