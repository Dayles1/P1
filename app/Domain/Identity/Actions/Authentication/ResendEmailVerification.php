<?php

namespace App\Domain\Identity\Actions\Authentication;

use App\Domain\Identity\Models\User;

class ResendEmailVerification
{
    /**
     * @return string|null The fresh challenge_token an unauthenticated
     *                     caller needs to submit the new code, or null if
     *                     the account was already verified (nothing sent).
     */
    public function handle(User $user): ?string
    {
        if ($user->hasVerifiedEmail()) {
            return null;
        }

        return $user->sendEmailVerificationCode();
    }
}
