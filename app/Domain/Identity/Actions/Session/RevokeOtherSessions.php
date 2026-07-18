<?php

namespace App\Domain\Identity\Actions\Session;

use App\Domain\Identity\Models\User;
use App\Domain\Identity\Repository\UserSessionRepositoryInterface;

class RevokeOtherSessions
{
    public function __construct(
        protected UserSessionRepositoryInterface $sessionRepository,
    ) {
    }

    public function handle(User $user): int
    {
        return $this->sessionRepository->revokeOthers($user);
    }
}