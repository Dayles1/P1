<?php

namespace App\Domain\Payment\Actions\Card;

use App\Domain\Identity\Models\User;
use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Exceptions\PaymentException;
use App\Domain\Payment\Exceptions\PaymentProviderException;
use App\Domain\Payment\Models\Card;
use App\Domain\Payment\Services\PaymentGatewayRegistry;

/**
 * Starts binding a card: the provider tokenises it and texts its owner a
 * code, which VerifyCard then confirms.
 *
 * The card number and expiry are handed to the provider and dropped;
 * what is kept is the provider's token (encrypted) and the masked number.
 */
class BindCard
{
    public function __construct(
        private readonly PaymentGatewayRegistry $gateways,
    ) {}

    /**
     * @param  string  $expiry  MMYY
     *
     * @throws PaymentException when the provider cannot store cards
     * @throws PaymentProviderException
     */
    public function handle(User $user, PaymentProvider $provider, string $cardNumber, string $expiry): Card
    {
        $token = $this->gateways->cardGateway($provider)->requestCardToken($cardNumber, $expiry);

        return Card::query()->create([
            'user_id' => $user->getKey(),
            'provider' => $provider,
            'token' => $token->token,
            'masked_pan' => $token->maskedPan,
            'expiry' => $token->expiry,
            'phone' => $token->phone,
            'verified_at' => $token->verified ? now() : null,
        ]);
    }
}
