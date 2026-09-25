<?php

namespace App\Infrastructure\Persistence\Eloquent\Profile;

use App\Domain\Identity\Models\User;
use App\Domain\Profile\Repository\ProfileRepositoryInterface;

class ProfileRepository implements ProfileRepositoryInterface
{
    public function get(User $user): User
    {
        $user->load([
            'department',
            'roles.permissions',
            'permissions',
            'ban',
            'avatar',
            'settings.timezone',
            'settings.preferredCurrency',
        ]);

        return $user->withCurrentSession();
    }
}
