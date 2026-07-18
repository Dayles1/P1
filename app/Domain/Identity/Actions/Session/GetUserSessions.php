<?php

namespace App\Domain\Identity\Actions\Session;

use App\Domain\Identity\Models\User;
use App\Domain\Identity\Repository\UserSessionRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class GetUserSessions
{
    public function __construct(
        protected UserSessionRepositoryInterface $sessionRepository,
    ) {
    }

    public function handle(User $user, array $filters = []): LengthAwarePaginator
    {
        return $this->sessionRepository->getUserSessions($user, $filters);
    }
}