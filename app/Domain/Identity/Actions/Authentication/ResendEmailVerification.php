<?php

namespace App\Domain\Identity\Actions\Authentication;

use App\Domain\Identity\Models\User;

class ResendEmailVerification
{
    public function handle(User $user): bool
    {
        if ($user->hasVerifiedEmail()) {
            return false;
        }

        $user->sendEmailVerificationNotification();

        return true;
    }
}
