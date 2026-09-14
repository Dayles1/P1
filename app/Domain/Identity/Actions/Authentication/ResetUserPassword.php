<?php

namespace App\Domain\Identity\Actions\Authentication;

use App\Domain\Identity\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class ResetUserPassword
{
    public function handle(array $data): void
    {
        $status = Password::broker('users')->reset(
            $data,
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => Hash::make($password),
                ])->save();

                $user->tokens()->delete();

                $user->sessions()
                    ->whereNull('logged_out_at')
                    ->update(['logged_out_at' => now()]);
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => __($status),
            ]);
        }
    }
}
