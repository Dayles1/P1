<?php

namespace App\Domain\Currency\Actions;

use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSetting;

class SaveFavoriteCurrencies
{
    /**
     * @param  list<int>  $currencyIds  in the order the user wants them
     */
    public function handle(User $user, array $currencyIds): UserSetting
    {
        $settings = $user->settings()->firstOrCreate(['user_id' => $user->id]);

        $settings->update([
            'favorite_currency_ids' => array_values(array_unique($currencyIds)),
        ]);

        return $settings->refresh();
    }
}
