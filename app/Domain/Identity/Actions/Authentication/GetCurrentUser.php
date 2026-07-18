<?php

namespace App\Domain\Identity\Actions\Authentication;

use App\Domain\Identity\Models\User;

class GetCurrentUser
{
    public function handle(User $user): User
    {
        return $user->load([
            'roles',
            'avatar',
        ]);
    }
}
