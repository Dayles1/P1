<?php

namespace Database\Seeders;

use App\Domain\AccessControl\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            [
                'code' => Role::SUPER_ADMIN,
                'translations' => [
                    'en' => 'Super Admin',
                    'ru' => 'Главный администратор',
                    'uz' => 'Bosh administrator',
                ],
            ],
            [
                'code' => Role::ADMIN,
                'translations' => [
                    'en' => 'Admin',
                    'ru' => 'Администратор',
                    'uz' => 'Administrator',
                ],
            ],
            [
                'code' => Role::USER,
                'translations' => [
                    'en' => 'User',
                    'ru' => 'Пользователь',
                    'uz' => 'Foydalanuvchi',
                ],
            ],
        ];

        foreach ($roles as $item) {
            $role = Role::query()->firstOrCreate(
                [
                    'code' => $item['code'],
                ],
                [
                    'name' => $item['translations']['en'],
                ]
            );

            foreach ($item['translations'] as $locale => $value) {
                $role->setTranslation('name', $locale, $value);
            }

            $role->save();
        }
    }
}