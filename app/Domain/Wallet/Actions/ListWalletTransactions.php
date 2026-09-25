<?php

namespace App\Domain\Wallet\Actions;

use App\Domain\Wallet\Models\Wallet;
use App\Domain\Wallet\Models\WalletTransaction;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * A wallet's ledger, newest first, with the payment behind each movement
 * (and through it, what the money was for).
 */
class ListWalletTransactions
{
    /**
     * @param  array{type?: string|null, per_page?: int|string|null}  $filters
     * @return LengthAwarePaginator<int, WalletTransaction>
     */
    public function handle(Wallet $wallet, array $filters = []): LengthAwarePaginator
    {
        return $wallet->transactions()
            ->when($filters['type'] ?? null, fn ($query, string $type) => $query->where('type', $type))
            ->with('payment')
            ->latest('id')
            ->paginate((int) ($filters['per_page'] ?? 20));
    }
}
