<?php

namespace Database\Seeders;

use App\Domain\Localization\Models\Language;
use Illuminate\Database\Seeder;

class LanguageSeeder extends Seeder
{
    public function run(): void
    {
        $languages = [
            ['code' => 'uz', 'name' => "O'zbekcha", 'is_default' => true],
            ['code' => 'ru', 'name' => 'Русский', 'is_default' => false],
            ['code' => 'en', 'name' => 'English', 'is_default' => false],
        ];

        foreach ($languages as $language) {
            Language::query()->updateOrCreate(
                ['code' => $language['code']],
                [
                    'name' => $language['name'],
                    'is_default' => $language['is_default'],
                    'is_active' => true,
                ]
            );
        }
    }
}
