<?php

namespace App\Domain\Payment\Exceptions;

use Illuminate\Contracts\Debug\ShouldntReport;
use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * A payment that cannot go ahead for a reason the payer can act on.
 * Rendered in the API's usual envelope.
 */
class PaymentException extends RuntimeException implements ShouldntReport
{
    public static function notPending(string $uuid): self
    {
        return new self(__('messages.payment.not_pending', ['payment' => $uuid]));
    }

    public static function invalidAmount(): self
    {
        return new self(__('messages.payment.invalid_amount'));
    }

    public static function unsupportedProvider(string $provider): self
    {
        return new self(__('messages.payment.unsupported_provider', ['provider' => $provider]));
    }

    public static function unsupportedCurrency(string $provider, string $code): self
    {
        return new self(__('messages.payment.unsupported_currency', ['provider' => $provider, 'currency' => $code]));
    }

    public static function cardUnusable(): self
    {
        return new self(__('messages.payment.card_unusable'));
    }

    public static function walletCannotPayItself(): self
    {
        return new self(__('messages.payment.wallet_cannot_pay_itself'));
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $this->getMessage(),
            'data' => null,
        ], 422);
    }
}
