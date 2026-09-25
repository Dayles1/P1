<?php

namespace App\Domain\Payment\Actions;

use App\Domain\Payment\Enums\PaymentStatus;
use App\Domain\Payment\Models\Payment;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Ends a pending payment without money moving — the provider declined
 * it, the payer abandoned it, or the provider cancelled it.
 *
 * Only a pending payment is changed. One that has already reached a
 * final state is returned as it is, so a repeated cancel is harmless and
 * a late "failed" can never undo a payment that succeeded; callers that
 * need to tell the two apart look at the returned status.
 */
class CancelPayment
{
    /**
     * @param  array<string, mixed>  $providerPayload
     */
    public function handle(
        Payment $payment,
        PaymentStatus $status = PaymentStatus::Cancelled,
        ?string $reason = null,
        array $providerPayload = [],
    ): Payment {
        if (! in_array($status, [PaymentStatus::Cancelled, PaymentStatus::Failed], true)) {
            throw new InvalidArgumentException("A payment cannot be cancelled into [{$status->value}].");
        }

        return DB::transaction(function () use ($payment, $status, $reason, $providerPayload): Payment {
            /** @var Payment $locked */
            $locked = Payment::query()->lockForUpdate()->findOrFail($payment->getKey());

            if (! $locked->isPending()) {
                return $locked;
            }

            $locked->forceFill([
                'status' => $status,
                'failure_reason' => $reason,
                'cancelled_at' => now(),
            ]);

            if ($providerPayload !== []) {
                $locked->mergeProviderPayload($providerPayload);
            }

            $locked->save();

            return $locked;
        });
    }
}
