<?php

namespace App\Domain\Payment\Actions\Card;

use App\Domain\Payment\Exceptions\PaymentProviderException;
use App\Domain\Payment\Models\Card;
use App\Domain\Payment\Services\PaymentGatewayRegistry;

/**
 * Confirms a card with the code the provider sent its owner, after which
 * it can be charged.
 */
class VerifyCard
{
    public function __construct(
        private readonly PaymentGatewayRegistry $gateways,
    ) {}

    /**
     * @throws PaymentProviderException when the provider refuses the code
     */
    public function handle(Card $card, string $code): Card
    {
        if ($card->isVerified()) {
            return $card;
        }

        $token = $this->gateways->cardGateway($card->provider)->verifyCardToken($card, $code);

        $card->forceFill([
            'token' => $token->token,
            'masked_pan' => $token->maskedPan,
            'expiry' => $token->expiry ?? $card->expiry,
            'verified_at' => now(),
        ])->save();

        return $card;
    }
}
