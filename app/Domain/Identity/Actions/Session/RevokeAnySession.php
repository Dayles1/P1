<?php

namespace App\Domain\Identity\Actions\Session;

use App\Domain\Identity\Models\UserSession;
use App\Domain\Identity\Repository\UserSessionRepositoryInterface;

class RevokeAnySession
{
    public function __construct(
        protected UserSessionRepositoryInterface $sessionRepository,
    ) {}

    public function handle(UserSession $session): void
    {
        $this->sessionRepository->revokeAny($session);
    }
}
