<?php

namespace App\Domain\Identity\Actions\Setting;

use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSetting;

class UpdateUserSettings
{
    public function handle(
        User $user,
        array $data
    ): UserSetting {

        $setting = $user->settings()
            ->firstOrCreate([
                'user_id' => $user->id,
            ]);

        $setting->update($data);

        return $setting->load('timezone');
    }
}