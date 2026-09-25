<?php

namespace App\Application\DTO\Payment;

use App\Domain\Payment\Enums\PaymentStatus;

/**
 * The outcome of charging a saved card. `Pending` means the provider
 * accepted the charge but has not settled it yet; its callback will.
 */
final class ChargeResult
{
    public function __construct(
        public readonly PaymentStatus $status,
        public readonly ?string $providerTransactionId = null,
        public readonly ?string $failureReason = null,
    ) {}

    public static function succeeded(?string $providerTransactionId): self
    {
        return new self(PaymentStatus::Succeeded, $providerTransactionId);
    }

    public static function pending(?string $providerTransactionId): self
    {
        return new self(PaymentStatus::Pending, $providerTransactionId);
    }

    public static function failed(string $reason, ?string $providerTransactionId = null): self
    {
        return new self(PaymentStatus::Failed, $providerTransactionId, $reason);
    }
}
