<?php

namespace App\Application\DTO\Payment;

/**
 * What a provider answers about a card it tokenised: its token and the
 * parts of the card that are safe to keep and show.
 */
final class CardTokenData
{
    public function __construct(
        public readonly string $token,
        public readonly string $maskedPan,
        public readonly ?string $expiry = null,
        public readonly ?string $phone = null,
        public readonly bool $verified = false,
    ) {}
}
