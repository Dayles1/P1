<?php

namespace App\Http\Resources\Wallet;

use App\Domain\Setting\Services\UserDateFormatter;
use App\Domain\Wallet\Models\WalletTransaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/**
 * @mixin WalletTransaction
 */
class WalletTransactionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $formatter = app(UserDateFormatter::class);
        $currency = $this->wallet->currency;

        return [
            'id' => $this->id,
            'type' => $this->type->value,

            /** Signed: negative when money left the wallet. */
            'amount' => $currency->fromMinorUnits($this->amount),
            'amount_minor' => $this->amount,
            'balance_before' => $currency->fromMinorUnits($this->balance_before),
            'balance_after' => $currency->fromMinorUnits($this->balance_after),
            'currency_code' => $currency->code,
            'description' => $this->description,
            'payment' => $this->whenLoaded('payment', fn (): ?array => $this->payment === null ? null : [
                'id' => $this->payment->uuid,
                'provider' => $this->payment->provider->value,
                'payable' => [
                    'type' => Str::snake(class_basename($this->payment->payable_type)),
                    'id' => $this->payment->payable_id,
                ],
            ]),
            'created_at' => $formatter->format($this->created_at, $request->user()),
        ];
    }
}
