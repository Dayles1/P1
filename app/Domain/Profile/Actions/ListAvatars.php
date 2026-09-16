<?php

namespace App\Domain\Profile\Actions;

use App\Domain\Identity\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;

class ListAvatars
{
    /**
     * @return LengthAwarePaginator<int, Model>
     */
    public function handle(User $user, int $perPage = 15): LengthAwarePaginator
    {
        return $user->avatars()
            ->latest()
            ->paginate($perPage);
    }
}
