<?php

namespace App\Domain\Profile\Actions;

use App\Domain\Identity\Models\User;

class UpdateProfile
{
    public function handle(User $user, array $data): User
    {
        unset($data['current_password']);

        if (array_key_exists('tags', $data)) {
            $data['profile_tags'] = $data['tags'] ?: null;
            unset($data['tags']);
        }

        if (isset($data['telegram'])) {
            $data['telegram'] = ltrim($data['telegram'], '@');
        }

        $emailChanged = array_key_exists('email', $data) && $data['email'] !== $user->email;

        $user->fill($data);

        if ($emailChanged) {
            $user->email_verified_at = null;
        }

        $user->save();

        if ($emailChanged) {
            $user->sendEmailVerificationNotification();
        }

        return $user->refresh();
    }
}
