<?php

namespace App\Domain\Profile\Actions;

use App\Domain\Identity\Models\User;

class UpdateProfile
{
    public function handle(User $user, array $data): User
    {
        $user->fill($data);

        $user->save();

        return $user->refresh();
    }
}
