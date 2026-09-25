<?php

namespace App\Http\Resources\Payment;

use App\Domain\Payment\Models\Card;
use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The provider's token is never part of this.
 *
 * @mixin Card
 */
class CardResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $formatter = app(UserDateFormatter::class);

        return [
            'id' => $this->id,
            'provider' => $this->provider->value,
            'masked_pan' => $this->masked_pan,
            'expiry' => $this->expiry,
            'phone' => $this->phone,
            'is_verified' => $this->isVerified(),
            'last_used_at' => $formatter->format($this->last_used_at, $request->user()),
            'created_at' => $formatter->format($this->created_at, $request->user()),
        ];
    }
}
