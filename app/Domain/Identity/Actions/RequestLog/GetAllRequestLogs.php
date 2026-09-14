<?php

namespace App\Domain\Identity\Actions\RequestLog;

use App\Domain\Identity\Repository\RequestLogRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class GetAllRequestLogs
{
    public function __construct(
        protected RequestLogRepositoryInterface $requestLogRepository,
    ) {}

    public function handle(array $filters = []): LengthAwarePaginator
    {
        return $this->requestLogRepository->all($filters);
    }
}
