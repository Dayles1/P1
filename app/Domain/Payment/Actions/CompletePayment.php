<?php

namespace App\Domain\Payment\Actions;

use App\Domain\Payment\Contracts\Payable;
use App\Domain\Payment\Enums\PaymentStatus;
use App\Domain\Payment\Exceptions\PaymentException;
use App\Domain\Payment\Models\Payment;
use Illuminate\Support\Facades\DB;
use LogicException;

/**
 * Marks a payment succeeded and applies it to what it paid for — once.
 *
 * Providers retry callbacks, and a card charge can be confirmed both by
 * its API response and by a callback, so this is called more than once
 * for the same payment as a matter of course. The payment row is locked
 * first, and a payment that is already succeeded is returned untouched:
 * whichever call gets the lock first applies it, every later one is a
 * no-op. The payable's hook runs inside the same transaction, so if it
 * fails the payment is left pending instead of paid-but-not-applied.
 */
class CompletePayment
{
    /**
     * @param  array<string, mixed>  $providerPayload
     *
     * @throws PaymentException when the payment already failed or was cancelled
     */
    public function handle(Payment $payment, ?string $providerTransactionId = null, array $providerPayload = []): Payment
    {
        return DB::transaction(function () use ($payment, $providerTransactionId, $providerPayload): Payment {
            /** @var Payment $locked */
            $locked = Payment::query()->lockForUpdate()->findOrFail($payment->getKey());

            if ($locked->isSucceeded()) {
                return $locked;
            }

            if (! $locked->isPending()) {
                throw PaymentException::notPending($locked->uuid);
            }

            $locked->forceFill([
                'status' => PaymentStatus::Succeeded,
                'paid_at' => now(),
                'provider_transaction_id' => $providerTransactionId ?? $locked->provider_transaction_id,
            ]);

            if ($providerPayload !== []) {
                $locked->mergeProviderPayload($providerPayload);
            }

            $locked->save();

            $payable = $locked->payable;

            if (! $payable instanceof Payable) {
                throw new LogicException("Payment [{$locked->uuid}] is for something that is not Payable.");
            }

            $payable->onPaymentSucceeded($locked);

            return $locked;
        });
    }
}
