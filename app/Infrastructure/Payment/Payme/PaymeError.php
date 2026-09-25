<?php

namespace App\Infrastructure\Payment\Payme;

use RuntimeException;

/**
 * A Merchant API error answer: Payme's error code, and for account
 * errors the name of the account field that was wrong.
 */
class PaymeError extends RuntimeException
{
    public function __construct(int $code, string $message, public readonly ?string $data = null)
    {
        parent::__construct($message, $code);
    }
}
