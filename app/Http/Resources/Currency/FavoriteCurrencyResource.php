<?php

namespace App\Http\Resources\Currency;

use App\Domain\Currency\Models\Currency;
use App\Domain\Currency\Services\CurrencyConverter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A pinned currency, quoted against the one this user reads prices in —
 * which is the only reason to pin it. The collection is already in the
 * user's own order, so there is no separate position field.
 *
 * @mixin Currency
 */
class FavoriteCurrencyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $converter = app(CurrencyConverter::class);
        $preferred = $converter->preferredCode($request->user());

        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'symbol' => $this->symbol,
            'decimals' => $this->decimals,
            'quote' => $converter->quote($preferred, $this->code),
        ];
    }
}
