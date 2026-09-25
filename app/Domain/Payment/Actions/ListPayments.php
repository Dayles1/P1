<?php

namespace App\Domain\Payment\Actions;

use App\Domain\Identity\Models\User;
use App\Domain\Payment\Models\Payment;
use Illuminate\Pagination\LengthAwarePaginator;

class ListPayments
{
    /**
     * @param  array{status?: string|null, provider?: string|null, per_page?: int|string|null}  $filters
     * @return LengthAwarePaginator<int, Payment>
     */
    public function handle(User $user, array $filters = []): LengthAwarePaginator
    {
        return Payment::query()
            ->where('user_id', $user->getKey())
            ->when($filters['status'] ?? null, fn ($query, string $status) => $query->where('status', $status))
            ->when($filters['provider'] ?? null, fn ($query, string $provider) => $query->where('provider', $provider))
            ->with(['currency', 'card'])
            ->latest('id')
            ->paginate((int) ($filters['per_page'] ?? 20));
    }
}
