<?php

namespace App\Domain\Payment\Contracts;

use App\Domain\Payment\Models\Payment;

/**
 * Something a payment can be for — a wallet top-up, a cargo, a paid
 * service. A model opts in by implementing this and pointing a
 * `morphMany(Payment::class, 'payable')` at itself if it wants the list.
 *
 * The hook runs inside the same database transaction that marks the
 * payment succeeded, and runs once per payment: a provider retrying its
 * callback does not call it again. If it throws, the payment stays
 * pending.
 */
interface Payable
{
    public function onPaymentSucceeded(Payment $payment): void;
}
