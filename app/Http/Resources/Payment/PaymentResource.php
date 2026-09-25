<?php

namespace App\Http\Resources\Payment;

use App\Domain\Payment\Models\Payment;
use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/**
 * @mixin Payment
 */
class PaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $formatter = app(UserDateFormatter::class);
        $user = $request->user();

        return [
            'id' => $this->uuid,
            'status' => $this->status->value,
            'provider' => $this->provider->value,

            /** As written in the currency, e.g. "1500.50". */
            'amount' => $this->decimalAmount(),
            'amount_minor' => $this->amount,
            'currency_code' => $this->currency->code,

            /** What the payment is for: "wallet" for a top-up, otherwise the business entity. */
            'payable' => [
                'type' => Str::snake(class_basename($this->payable_type)),
                'id' => $this->payable_id,
            ],

            /** The link the payer opens, or encodes in a QR — only while it can still be paid. */
            'checkout_url' => $this->isPending() ? $this->checkout_url : null,

            'card' => $this->whenLoaded('card', fn (): ?CardResource => $this->card === null ? null : new CardResource($this->card)),
            'description' => $this->description,
            'failure_reason' => $this->failure_reason,
            'paid_at' => $formatter->format($this->paid_at, $user),
            'created_at' => $formatter->format($this->created_at, $user),
        ];
    }
}
