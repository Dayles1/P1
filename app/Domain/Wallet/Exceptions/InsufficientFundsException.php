<?php

namespace App\Domain\Wallet\Exceptions;

use Illuminate\Contracts\Debug\ShouldntReport;
use Illuminate\Http\JsonResponse;
use RuntimeException;

class InsufficientFundsException extends RuntimeException implements ShouldntReport
{
    public static function forAmount(int $balance, int $amount): self
    {
        return new self("Wallet balance {$balance} is less than {$amount}.");
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => __('messages.wallet.insufficient_funds'),
            'data' => null,
        ], 422);
    }
}
