<?php

namespace Database\Seeders;

use App\Domain\AccessControl\Models\Role;
use App\Domain\Identity\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $userRole = Role::query()
            ->where('code', 'user')
            ->firstOrFail();

        User::factory()
            ->count(100)
            ->create()
            ->each(function (User $user) use ($userRole): void {
                // $user->roles()->attach($userRole->id);
                // yoki:
                $user->assignRole($userRole);
            });
    }
}