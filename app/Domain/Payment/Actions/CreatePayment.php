<?php

namespace App\Domain\Payment\Actions;

use App\Domain\Currency\Models\Currency;
use App\Domain\Identity\Models\User;
use App\Domain\Payment\Contracts\Payable;
use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Enums\PaymentStatus;
use App\Domain\Payment\Exceptions\PaymentException;
use App\Domain\Payment\Exceptions\PaymentProviderException;
use App\Domain\Payment\Models\Card;
use App\Domain\Payment\Models\Payment;
use App\Domain\Payment\Services\PaymentGatewayRegistry;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Exceptions\InsufficientFundsException;
use App\Domain\Wallet\Models\Wallet;
use App\Domain\Wallet\Services\WalletLedger;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * The single entry point for paying for anything.
 *
 * Whatever the payable is (a wallet top-up, a cargo, a service), the
 * payment is recorded first and then taken one of three ways:
 *
 *  - from the wallet balance: debited and completed at once, in one
 *    transaction, or not at all;
 *  - from a saved card: charged through the card's provider right away;
 *  - otherwise: an external checkout link / QR is created and the
 *    payment waits for the provider's callback.
 *
 * With an idempotency key, calling this again with the same key returns
 * the payment the first call made instead of charging twice.
 */
class CreatePayment
{
    public function __construct(
        private readonly PaymentGatewayRegistry $gateways,
        private readonly WalletLedger $ledger,
        private readonly CompletePayment $completePayment,
        private readonly CancelPayment $cancelPayment,
    ) {}

    /**
     * @param  int  $amount  minor units of `$currency`
     * @param  array<string, mixed>  $metadata
     *
     * @throws PaymentException
     * @throws PaymentProviderException
     * @throws InsufficientFundsException
     */
    public function handle(
        User $user,
        Model&Payable $payable,
        int $amount,
        Currency $currency,
        PaymentProvider $provider,
        ?Card $card = null,
        ?string $idempotencyKey = null,
        ?string $description = null,
        array $metadata = [],
    ): Payment {
        if ($idempotencyKey !== null && ($existing = $this->findByIdempotencyKey($user, $idempotencyKey))) {
            return $existing;
        }

        $this->ensurePayable($user, $payable, $amount, $provider, $card);

        try {
            $payment = Payment::query()->create([
                'user_id' => $user->getKey(),
                'payable_type' => $payable->getMorphClass(),
                'payable_id' => $payable->getKey(),
                'provider' => $provider,
                'card_id' => $card?->getKey(),
                'amount' => $amount,
                'currency_id' => $currency->getKey(),
                'status' => PaymentStatus::Pending,
                'idempotency_key' => $idempotencyKey,
                'description' => $description,
                'metadata' => $metadata === [] ? null : $metadata,
            ]);
        } catch (UniqueConstraintViolationException $e) {
            /*
             * Two requests with the same key raced past the lookup above;
             * the one that lost gets the winner's payment.
             */
            return $this->findByIdempotencyKey($user, (string) $idempotencyKey) ?? throw $e;
        }

        $payment->setRelation('currency', $currency);
        $payment->setRelation('payable', $payable);

        return match (true) {
            $provider === PaymentProvider::Wallet => $this->payFromWallet($payment, $user, $currency),
            $card !== null => $this->chargeCard($payment, $card),
            default => $this->startCheckout($payment),
        };
    }

    private function ensurePayable(User $user, Model $payable, int $amount, PaymentProvider $provider, ?Card $card): void
    {
        if ($amount <= 0) {
            throw PaymentException::invalidAmount();
        }

        if ($provider === PaymentProvider::Wallet && $payable instanceof Wallet) {
            throw PaymentException::walletCannotPayItself();
        }

        if ($card !== null && (
            (int) $card->user_id !== (int) $user->getKey()
            || ! $card->isVerified()
            || $card->provider !== $provider
            || $card->trashed()
        )) {
            throw PaymentException::cardUnusable();
        }

        if ($provider->isExternal()) {
            $card === null
                ? $this->gateways->gateway($provider)
                : $this->gateways->cardGateway($provider);
        }
    }

    private function payFromWallet(Payment $payment, User $user, Currency $currency): Payment
    {
        try {
            return DB::transaction(function () use ($payment, $user, $currency): Payment {
                $this->ledger->debit(
                    wallet: Wallet::resolveFor($user, $currency),
                    amount: $payment->amount,
                    type: WalletTransactionType::Payment,
                    payment: $payment,
                    description: $payment->description,
                );

                return $this->completePayment->handle($payment);
            });
        } catch (InsufficientFundsException $e) {
            $this->cancelPayment->handle($payment, PaymentStatus::Failed, 'insufficient_funds');

            throw $e;
        }
    }

    private function chargeCard(Payment $payment, Card $card): Payment
    {
        /*
         * A provider error here leaves the payment pending on purpose: the
         * charge may or may not have gone through, and the provider's
         * callback is what settles it.
         */
        $result = $this->gateways->cardGateway($payment->provider)->chargeCard($payment, $card);

        $card->forceFill(['last_used_at' => now()])->save();

        return match ($result->status) {
            PaymentStatus::Succeeded => $this->completePayment->handle($payment, $result->providerTransactionId),
            PaymentStatus::Pending => tap($payment)->update(['provider_transaction_id' => $result->providerTransactionId]),
            default => $this->cancelPayment->handle($payment, PaymentStatus::Failed, $result->failureReason),
        };
    }

    private function startCheckout(Payment $payment): Payment
    {
        try {
            $checkout = $this->gateways->gateway($payment->provider)->createCheckout($payment);
        } catch (PaymentException $e) {
            $this->cancelPayment->handle($payment, PaymentStatus::Failed, $e->getMessage());

            throw $e;
        }

        $payment->forceFill([
            'checkout_url' => $checkout->url,
            'provider_transaction_id' => $checkout->providerTransactionId,
        ]);

        if ($checkout->providerPayload !== []) {
            $payment->mergeProviderPayload($checkout->providerPayload);
        }

        $payment->save();

        return $payment;
    }

    private function findByIdempotencyKey(User $user, string $idempotencyKey): ?Payment
    {
        return Payment::query()
            ->where('user_id', $user->getKey())
            ->where('idempotency_key', $idempotencyKey)
            ->first();
    }
}
