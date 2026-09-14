<?php

namespace App\Domain\Identity\Actions\Session;

use App\Domain\Identity\Repository\UserSessionRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class GetAllSessions
{
    public function __construct(
        protected UserSessionRepositoryInterface $sessionRepository,
    ) {}

    public function handle(array $filters = []): LengthAwarePaginator
    {
        return $this->sessionRepository->all($filters);
    }
}
