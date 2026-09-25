<?php

namespace App\Domain\Payment\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * A provider could not be reached, or answered and refused what we asked
 * of it. The two are told apart because they mean different things for a
 * charge: a refusal is a definite "no", while an unreachable provider may
 * or may not have taken the money.
 */
class PaymentProviderException extends RuntimeException
{
    private bool $rejected = false;

    private string $reason = '';

    public static function unreachable(string $provider, string $reason): self
    {
        $exception = new self("Payment provider [{$provider}] is unreachable: {$reason}");
        $exception->reason = $reason;

        return $exception;
    }

    public static function rejected(string $provider, string $reason): self
    {
        $exception = new self("Payment provider [{$provider}] rejected the request: {$reason}");
        $exception->rejected = true;
        $exception->reason = $reason;

        return $exception;
    }

    public static function notConfigured(string $provider): self
    {
        return new self("Payment provider [{$provider}] is not configured.");
    }

    public function wasRejected(): bool
    {
        return $this->rejected;
    }

    /**
     * The provider's own explanation, without our prefix.
     */
    public function reason(): string
    {
        return $this->reason;
    }

    /**
     * A refusal (a wrong confirmation code, a declined card) is the
     * payer's to fix and says why; anything else is on our side.
     */
    public function render(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => $this->rejected
                ? __('messages.payment.provider_rejected')
                : __('messages.payment.provider_failed'),
            'data' => $this->rejected ? ['reason' => $this->reason] : null,
        ], $this->rejected ? 422 : 502);
    }
}
