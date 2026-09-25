<?php

namespace App\Domain\Payment\Enums;

/**
 * Where the money for a payment comes from. `Wallet` is the user's own
 * balance inside the app; every other case is an external provider with
 * a gateway in App\Infrastructure\Payment.
 */
enum PaymentProvider: string
{
    case Wallet = 'wallet';
    case Click = 'click';
    case Payme = 'payme';
    case OneQr = 'oneqr';

    public function isExternal(): bool
    {
        return $this !== self::Wallet;
    }

    /**
     * @return list<self>
     */
    public static function external(): array
    {
        return array_values(array_filter(self::cases(), fn (self $provider): bool => $provider->isExternal()));
    }
}
