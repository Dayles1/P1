<?php

namespace App\Domain\Identity\Actions\RequestLog;

use App\Domain\Identity\Models\UserSession;
use App\Domain\Identity\Repository\RequestLogRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class GetSessionRequestLogs
{
    public function __construct(
        protected RequestLogRepositoryInterface $requestLogRepository,
    ) {}

    public function handle(UserSession $session, array $filters = []): LengthAwarePaginator
    {
        return $this->requestLogRepository->forSession($session, $filters);
    }
}
