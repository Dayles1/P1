<?php

namespace App\Http\Resources\Currency;

use App\Domain\Currency\Models\ExchangeRate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ExchangeRate
 */
class ExchangeRateResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'currency' => new CurrencyResource($this->whenLoaded('currency')),
            'base_code' => $this->base_code,
            'rate' => (string) $this->rate,

            /*
             * The day these rates are for, which is not necessarily the
             * day asked for: a currency with no row yet today keeps the
             * last one it had.
             */
            'rate_date' => $this->rate_date?->toDateString(),
            'source' => $this->source,
            'fetched_at' => $this->fetched_at?->toIso8601String(),
        ];
    }
}
