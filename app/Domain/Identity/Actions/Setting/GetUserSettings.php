<?php

namespace App\Domain\Identity\Actions\Setting;

use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSetting;

class GetUserSettings
{
    public function handle(User $user): UserSetting
{
    $setting = $user->settings()
        ->firstOrCreate([
            'user_id' => $user->id,
        ]);

    return $setting->load('timezone');
}
}