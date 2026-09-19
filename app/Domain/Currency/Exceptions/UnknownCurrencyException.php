<?php

namespace App\Domain\Currency\Exceptions;

use RuntimeException;

class UnknownCurrencyException extends RuntimeException
{
    public static function code(string $code): self
    {
        return new self("No active currency with code [{$code}].");
    }
}
