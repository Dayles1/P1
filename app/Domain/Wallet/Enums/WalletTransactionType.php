<?php

namespace App\Domain\Wallet\Enums;

enum WalletTransactionType: string
{
    /** Money topped up from an external provider. */
    case Deposit = 'deposit';

    /** Money spent from the balance on a payable. */
    case Payment = 'payment';

    /** A spend given back. */
    case Refund = 'refund';

    /** A manual correction, either way. */
    case Adjustment = 'adjustment';
}
