<?php

namespace App\Domain\Identity\Actions\Authentication;

use App\Domain\Identity\Models\User;
use Illuminate\Support\Facades\Hash;

class ConfirmUserPassword
{
    public function handle(User $user, string $password): bool
    {
        return Hash::check($password, $user->password);
    }
}
