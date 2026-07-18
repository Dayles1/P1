<?php

namespace App\Domain\Identity\Actions\User;

use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSetting;
use App\Domain\Setting\Models\Timezone;
use App\Domain\Setting\Services\SettingService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class CreateUser
{
    public function __construct(
        private readonly SettingService $settings,
    ) {
    }

    public function handle(array $data): User
    {
        return DB::transaction(function () use ($data) {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
            ]);

            $timezoneName = $data['timezone']
                ?? $this->settings->string(
                    'localization.default_timezone',
                    'UTC'
                );


            $timezone = Timezone::where('name', $timezoneName)
                ->first();


            if (!$timezone) {
                $timezone = Timezone::where('name', 'UTC')
                    ->first();
            }


            UserSetting::create([
                'user_id' => $user->id,
                'timezone_id' => $timezone?->id,
                'timezone_source' => $data['timezone_source'] ?? 'manual',
            ]);

            return $user;
        });
    }
}
