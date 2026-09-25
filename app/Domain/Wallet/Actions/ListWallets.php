<?php

namespace App\Domain\Wallet\Actions;

use App\Domain\Identity\Models\User;
use App\Domain\Wallet\Models\Wallet;
use Illuminate\Database\Eloquent\Collection;

class ListWallets
{
    /**
     * @return Collection<int, Wallet>
     */
    public function handle(User $user): Collection
    {
        return Wallet::query()
            ->where('user_id', $user->getKey())
            ->with('currency')
            ->orderBy('id')
            ->get();
    }
}
