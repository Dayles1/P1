<?php

namespace App\Domain\Payment\Repository;

use App\Application\DTO\Payment\CheckoutData;
use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Exceptions\PaymentException;
use App\Domain\Payment\Exceptions\PaymentProviderException;
use App\Domain\Payment\Models\Payment;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * An external payment provider. Adding one is a class implementing this,
 * a PaymentProvider case and a line in InfrastructureServiceProvider —
 * nothing in the payment flow itself changes.
 *
 * A gateway speaks its provider's protocol and nothing else: it decides
 * whether a callback is authentic and what the provider is saying, then
 * hands the outcome to CompletePayment / CancelPayment, which are what
 * make applying a payment idempotent.
 */
interface PaymentGatewayInterface
{
    public function provider(): PaymentProvider;

    /**
     * A link (or the QR payload) the payer opens to pay this payment.
     *
     * @throws PaymentException when the provider cannot take this payment (e.g. its currency)
     * @throws PaymentProviderException
     */
    public function createCheckout(Payment $payment): CheckoutData;

    /**
     * Answers the provider's server-to-server notification, in whatever
     * shape that provider expects back. Must be safe to receive the same
     * notification any number of times.
     */
    public function handleCallback(Request $request): Response;
}
