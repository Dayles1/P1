<?php

namespace App\Application\DTO\Payment;

/**
 * Where to send the payer to pay an external checkout. The same link is
 * what a QR code encodes, so one field serves both.
 */
final class CheckoutData
{
    /**
     * @param  array<string, mixed>  $providerPayload  anything the provider handed back that later calls need
     */
    public function __construct(
        public readonly string $url,
        public readonly ?string $providerTransactionId = null,
        public readonly array $providerPayload = [],
    ) {}
}
