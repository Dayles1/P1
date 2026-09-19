<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            TimezoneSeeder::class,
            LanguageSeeder::class,
            SuperAdminSeeder::class,
            SettingSeeder::class,

            // Currencies after settings: the sync quotes against
            // system.base_currency_code, and rates need the catalogue.
            CurrencySeeder::class,
            ExchangeRateSeeder::class,
        ]);
    }
}
