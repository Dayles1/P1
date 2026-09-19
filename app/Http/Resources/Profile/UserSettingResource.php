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
    public function toArray(Request $request): array
    {
        return [
            'timezone' => $this->whenLoaded('timezone') ? [
                'id' => $this->timezone->id,
                'name' => $this->timezone->name,
                'label' => $this->timezone->label,
                'offset' => $this->timezone->offset,
            ] : null,
            'timezone_source' => $this->timezone_source,

            /*
             * Null means "the app currency" rather than "unset" — see
             * CurrencyConverter::preferredCode().
             */
            'currency' => $this->whenLoaded('preferredCurrency') ? [
                'id' => $this->preferredCurrency->id,
                'code' => $this->preferredCurrency->code,
                'name' => $this->preferredCurrency->name,
                'symbol' => $this->preferredCurrency->symbol,
                'decimals' => $this->preferredCurrency->decimals,
            ] : null,
            'favorite_currency_ids' => $this->favorite_currency_ids ?? [],
            'locale' => $this->locale,
            'theme' => $this->theme,
            'date_format' => $this->date_format,
            'time_format' => $this->time_format,
            'meta' => $this->meta,
            'require_login_verification' => (bool) $this->require_login_verification,
        ];
    }
}
