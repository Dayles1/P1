<?php

namespace App\Domain\Wallet\Services;

use App\Domain\Payment\Models\Payment;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Exceptions\InsufficientFundsException;
use App\Domain\Wallet\Models\Wallet;
use App\Domain\Wallet\Models\WalletTransaction;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * The only way a wallet's balance changes.
 *
 * Each movement re-reads the wallet under a row lock (SELECT ... FOR
 * UPDATE), so two payments against the same wallet at the same time are
 * applied one after the other: the second one sees the balance the first
 * one left, not the one both started from. The balance update and its
 * ledger row are written in the same transaction, so they cannot drift.
 *
 * On top of that the ledger is unique per (payment, type), so even a
 * caller that got the idempotency wrong cannot credit one payment twice.
 */
class WalletLedger
{
    /**
     * @param  int  $amount  minor units, positive
     * @param  array<string, mixed>  $metadata
     */
    public function credit(
        Wallet $wallet,
        int $amount,
        WalletTransactionType $type,
        ?Payment $payment = null,
        ?string $description = null,
        array $metadata = [],
    ): WalletTransaction {
        return $this->move($wallet, $amount, $type, $payment, $description, $metadata);
    }

    /**
     * @param  int  $amount  minor units, positive
     * @param  array<string, mixed>  $metadata
     *
     * @throws InsufficientFundsException
     */
    public function debit(
        Wallet $wallet,
        int $amount,
        WalletTransactionType $type,
        ?Payment $payment = null,
        ?string $description = null,
        array $metadata = [],
    ): WalletTransaction {
        return $this->move($wallet, -$amount, $type, $payment, $description, $metadata);
    }

    /**
     * @param  int  $delta  signed minor units
     * @param  array<string, mixed>  $metadata
     */
    private function move(
        Wallet $wallet,
        int $delta,
        WalletTransactionType $type,
        ?Payment $payment,
        ?string $description,
        array $metadata,
    ): WalletTransaction {
        if ($delta === 0) {
            throw new InvalidArgumentException('A wallet movement needs a non-zero amount.');
        }

        return DB::transaction(function () use ($wallet, $delta, $type, $payment, $description, $metadata): WalletTransaction {
            /** @var Wallet $locked */
            $locked = Wallet::query()->lockForUpdate()->findOrFail($wallet->getKey());

            $before = $locked->balance;
            $after = $before + $delta;

            if ($after < 0) {
                throw InsufficientFundsException::forAmount($before, -$delta);
            }

            $locked->forceFill(['balance' => $after])->save();

            $transaction = $locked->transactions()->create([
                'type' => $type,
                'amount' => $delta,
                'balance_before' => $before,
                'balance_after' => $after,
                'payment_id' => $payment?->getKey(),
                'description' => $description,
                'metadata' => $metadata === [] ? null : $metadata,
            ]);

            $wallet->setRawAttributes($locked->getAttributes(), true);

            return $transaction;
        });
    }
}
