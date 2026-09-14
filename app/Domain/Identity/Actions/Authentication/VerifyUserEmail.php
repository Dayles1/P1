<?php

namespace App\Domain\Identity\Actions\Authentication;

use App\Domain\Identity\Models\User;
use Illuminate\Auth\Events\Verified;

class VerifyUserEmail
{
    public function handle(User $user): bool
    {
        if ($user->hasVerifiedEmail()) {
            return false;
        }

        $user->markEmailAsVerified();

        event(new Verified($user));

        return true;
    }
}
