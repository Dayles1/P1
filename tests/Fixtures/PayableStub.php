<?php

namespace Tests\Fixtures;

use App\Domain\Payment\Contracts\Payable;
use App\Domain\Payment\Models\Payment;
use Illuminate\Database\Eloquent\Model;

/**
 * Something to pay for.
 *
 * Nothing in the app sells anything yet (no cargo, no paid service), and
 * whatever eventually does opts in exactly like this. It counts how many
 * times it was told it was paid, so a test can prove it happened once.
 */
class PayableStub extends Model implements Payable
{
    protected $table = 'payable_stubs';

    protected $guarded = [];

    public function onPaymentSucceeded(Payment $payment): void
    {
        $this->increment('times_paid');
    }
}
