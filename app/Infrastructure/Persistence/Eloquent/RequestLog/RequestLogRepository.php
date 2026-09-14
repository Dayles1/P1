<?php

namespace App\Infrastructure\Persistence\Eloquent\RequestLog;

use App\Domain\Identity\Models\RequestLog;
use App\Domain\Identity\Models\UserSession;
use App\Domain\Identity\Repository\RequestLogRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class RequestLogRepository implements RequestLogRepositoryInterface
{
    public function forSession(UserSession $session, array $filters = []): LengthAwarePaginator
    {
        return $this->applyFilters($session->requestLogs()->getQuery(), $filters)->paginate(
            $filters['per_page'] ?? 20
        );
    }

    public function all(array $filters = []): LengthAwarePaginator
    {
        return $this->applyFilters(
            RequestLog::query()->with(['user:id,name,email', 'session:id,device_name,ip_address']),
            $filters
        )->paginate($filters['per_page'] ?? 20);
    }

    private function applyFilters(Builder $query, array $filters): Builder
    {
        if (! empty($filters['method'])) {
            $query->where('method', strtoupper($filters['method']));
        }

        if (! empty($filters['status'])) {
            match ($filters['status']) {
                '2xx' => $query->whereBetween('status_code', [200, 299]),
                '3xx' => $query->whereBetween('status_code', [300, 399]),
                '4xx' => $query->whereBetween('status_code', [400, 499]),
                '5xx' => $query->whereBetween('status_code', [500, 599]),
                default => null,
            };
        }

        if (! empty($filters['status_code'])) {
            $query->where('status_code', (int) $filters['status_code']);
        }

        if (! empty($filters['user_id'])) {
            $query->where('user_id', (int) $filters['user_id']);
        }

        if (! empty($filters['search'])) {
            $query->where(function (Builder $q) use ($filters) {
                $q->where('path', 'like', '%'.$filters['search'].'%')
                    ->orWhere('route_name', 'like', '%'.$filters['search'].'%');
            });
        }

        if (! empty($filters['from'])) {
            $query->where('created_at', '>=', $filters['from']);
        }

        if (! empty($filters['to'])) {
            $query->where('created_at', '<=', $filters['to']);
        }

        $direction = ($filters['sort'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        return $query->orderBy('created_at', $direction)->orderBy('id', $direction);
    }
}
