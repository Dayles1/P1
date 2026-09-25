<?php

namespace App\Domain\Payment\Repository;

use App\Application\DTO\Payment\CardTokenData;
use App\Application\DTO\Payment\ChargeResult;
use App\Domain\Payment\Exceptions\PaymentProviderException;
use App\Domain\Payment\Models\Card;
use App\Domain\Payment\Models\Payment;

/**
 * A provider that can tokenise a card and charge the token later. Kept
 * apart from PaymentGatewayInterface because not every provider can
 * (OneQR is checkout only).
 *
 * The card number and expiry pass through `requestCardToken()` on their
 * way to the provider and must not be stored or logged by an
 * implementation.
 */
interface CardTokenGatewayInterface
{
    /**
     * Registers a card with the provider, which sends its owner a
     * confirmation code.
     *
     * @param  string  $expiry  MMYY
     *
     * @throws PaymentProviderException
     */
    public function requestCardToken(string $cardNumber, string $expiry): CardTokenData;

    /**
     * Confirms a card with the code its owner received.
     *
     * @throws PaymentProviderException
     */
    public function verifyCardToken(Card $card, string $code): CardTokenData;

    /**
     * @throws PaymentProviderException when the provider could not be asked at all
     */
    public function chargeCard(Payment $payment, Card $card): ChargeResult;

    /**
     * Tells the provider to forget the token. Best effort.
     */
    public function removeCardToken(Card $card): void;
}
