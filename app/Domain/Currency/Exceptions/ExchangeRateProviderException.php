<?php

namespace App\Domain\Currency\Exceptions;

use RuntimeException;

class ExchangeRateProviderException extends RuntimeException
{
    public static function unreachable(string $reason): self
    {
        return new self("Exchange rate provider is unreachable: {$reason}");
    }

    public static function unusableResponse(string $reason): self
    {
        return new self("Exchange rate provider returned an unusable response: {$reason}");
    }
}
