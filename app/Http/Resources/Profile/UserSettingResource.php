<?php

namespace App\Http\Resources\Profile;

use App\Domain\Identity\Models\UserSetting;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin UserSetting
 */
class UserSettingResource extends JsonResource
{
    /**
     * Both relations below are read through the model rather than
     * `whenLoaded()`: with a single argument that helper returns a
     * MissingValue — an *object*, so always truthy — when the relation
     * isn't loaded, which sent a plain ternary down the "present" branch
     * and dereferenced a relation that can legitimately be null (a
     * settings row with no timezone, or no preferred currency). Every
     * caller renders one user's settings, never a collection, so there
     * is no N+1 to protect against here.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $timezone = $this->timezone;
        $currency = $this->preferredCurrency;

        return [
            'timezone' => $timezone ? [
                'id' => $timezone->id,
                'name' => $timezone->name,
                'label' => $timezone->label,
                'offset' => $timezone->offset,
            ] : null,
            'timezone_source' => $this->timezone_source,

            /*
             * Null means "the app currency" rather than "unset" — see
             * CurrencyConverter::preferredCode().
             */
            'currency' => $currency ? [
                'id' => $currency->id,
                'code' => $currency->code,
                'name' => $currency->name,
                'symbol' => $currency->symbol,
                'decimals' => $currency->decimals,
            ] : null,
            'favorite_currency_ids' => $this->favorite_currency_ids ?? [],
            'locale' => $this->locale,
            'theme' => $this->theme,
            'accent' => $this->accent,
            'date_format' => $this->date_format,
            'time_format' => $this->time_format,
            'meta' => $this->meta,
            'require_login_verification' => (bool) $this->require_login_verification,
        ];
    }
}
