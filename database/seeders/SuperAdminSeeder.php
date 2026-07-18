<?php

namespace Database\Seeders;

use App\Domain\AccessControl\Models\Role;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSetting;
use App\Domain\Setting\Models\Timezone;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::query()->firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Super Admin',
                'password' => Hash::make('password'),
            ]
        );

        $timezone = Timezone::where('name', 'Asia/Tashkent')
            ->first();

        UserSetting::updateOrCreate(
            [
                'user_id' => $user->id,
            ],
            [
                'timezone_id' => $timezone?->id,
                'timezone_source' => 'manual',
            ]
        );

        $role = Role::query()
            ->where('code', Role::SUPER_ADMIN)
            ->firstOrFail();

        $user->roles()->syncWithoutDetaching([
            $role->getKey(),
        ]);
    }
}