<?php

namespace App\Http\Resources\Wallet;

use App\Domain\Wallet\Models\Wallet;
use App\Http\Resources\Currency\CurrencyResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Wallet
 */
class WalletResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'currency' => new CurrencyResource($this->currency),

            /** As written in the currency, e.g. "1500.50". */
            'balance' => $this->decimalBalance(),
            'balance_minor' => $this->balance,
        ];
    }
}
