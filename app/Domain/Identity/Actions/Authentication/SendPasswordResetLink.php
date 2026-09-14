<?php

namespace App\Domain\Identity\Actions\Authentication;

use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class SendPasswordResetLink
{
    public function handle(string $email): void
    {
        $status = Password::broker('users')->sendResetLink(['email' => $email]);

        if ($status !== Password::RESET_LINK_SENT) {
            throw ValidationException::withMessages([
                'email' => __($status),
            ]);
        }
    }
}
