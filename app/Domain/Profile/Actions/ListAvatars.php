<?php

namespace App\Domain\Profile\Actions;

use App\Domain\Identity\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class ListAvatars
{
    public function handle(User $user, int $perPage = 15): LengthAwarePaginator
    {
        return $user->avatars()
            ->latest()
            ->paginate($perPage);
    }
}