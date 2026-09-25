<?php

namespace App\Domain\Payment\Actions\Card;

use App\Domain\Payment\Exceptions\PaymentProviderException;
use App\Domain\Payment\Models\Card;
use App\Domain\Payment\Services\PaymentGatewayRegistry;

/**
 * Removes a saved card. The provider is asked to forget the token, but a
 * provider that cannot be reached does not keep the card on the user's
 * list: it is soft deleted either way, and never charged again.
 */
class RemoveCard
{
    public function __construct(
        private readonly PaymentGatewayRegistry $gateways,
    ) {}

    public function handle(Card $card): void
    {
        try {
            $this->gateways->cardGateway($card->provider)->removeCardToken($card);
        } catch (PaymentProviderException $e) {
            report($e);
        }

        $card->delete();
    }
}
