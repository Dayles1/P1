<?php

namespace App\Domain\Payment\Enums;

/**
 * A payment starts pending and moves exactly once, to one of the final
 * states. Nothing moves it back.
 */
enum PaymentStatus: string
{
    case Pending = 'pending';
    case Succeeded = 'succeeded';
    case Failed = 'failed';
    case Cancelled = 'cancelled';

    public function isFinal(): bool
    {
        return $this !== self::Pending;
    }
}
