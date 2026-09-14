<?php

namespace App\Domain\Identity\Repository;

use App\Domain\Identity\Models\UserSession;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface RequestLogRepositoryInterface
{
    public function forSession(UserSession $session, array $filters = []): LengthAwarePaginator;

    public function all(array $filters = []): LengthAwarePaginator;
}
