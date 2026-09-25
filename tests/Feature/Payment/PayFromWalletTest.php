<?php

use App\Domain\Identity\Models\User;
use App\Domain\Payment\Actions\CompletePayment;
use App\Domain\Payment\Actions\CreatePayment;
use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Enums\PaymentStatus;
use App\Domain\Payment\Exceptions\PaymentException;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Exceptions\InsufficientFundsException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\Fixtures\PayableStub;

beforeEach(function () {
    Schema::create('payable_stubs', function (Blueprint $table) {
        $table->id();
        $table->unsignedInteger('times_paid')->default(0);
        $table->timestamps();
    });

    configurePaymentProviders();

    $this->user = User::factory()->create();
    $this->uzs = currencyRow('UZS');
    $this->cargo = PayableStub::create();
    $this->createPayment = app(CreatePayment::class);
});

test('paying from the wallet debits it and settles the payable in one go', function () {
    $wallet = fundedWallet($this->user, 100_000);

    $payment = $this->createPayment->handle($this->user, $this->cargo, 40_000, $this->uzs, PaymentProvider::Wallet);

    $debit = $wallet->transactions()->where('type', WalletTransactionType::Payment)->sole();

    expect($payment->status)->toBe(PaymentStatus::Succeeded)
        ->and($payment->paid_at)->not->toBeNull()
        ->and($payment->payable_type)->toBe(PayableStub::class)
        ->and($payment->payable_id)->toBe($this->cargo->id)
        ->and($wallet->fresh()->balance)->toBe(60_000)
        ->and($debit->amount)->toBe(-40_000)
        ->and($debit->payment_id)->toBe($payment->id)
        ->and($this->cargo->fresh()->times_paid)->toBe(1);
});

test('without enough balance nothing is debited, the payable is untouched and the payment is failed', function () {
    $wallet = fundedWallet($this->user, 10_000);

    expect(fn () => $this->createPayment->handle($this->user, $this->cargo, 40_000, $this->uzs, PaymentProvider::Wallet))
        ->toThrow(InsufficientFundsException::class);

    expect($wallet->fresh()->balance)->toBe(10_000)
        ->and($this->cargo->fresh()->times_paid)->toBe(0)
        ->and($this->user->payments()->sole()->status)->toBe(PaymentStatus::Failed)
        ->and($this->user->payments()->sole()->failure_reason)->toBe('insufficient_funds');
});

test('completing a payment again does not apply it again', function () {
    fundedWallet($this->user, 100_000);

    $payment = $this->createPayment->handle($this->user, $this->cargo, 40_000, $this->uzs, PaymentProvider::Wallet);

    app(CompletePayment::class)->handle($payment);
    app(CompletePayment::class)->handle($payment->fresh());

    expect($this->cargo->fresh()->times_paid)->toBe(1)
        ->and($this->user->wallets()->sole()->balance)->toBe(60_000);
});

test('the same idempotency key returns the first payment instead of paying twice', function () {
    fundedWallet($this->user, 100_000);

    $first = $this->createPayment->handle($this->user, $this->cargo, 40_000, $this->uzs, PaymentProvider::Wallet, idempotencyKey: 'order-1');
    $retry = $this->createPayment->handle($this->user, $this->cargo, 40_000, $this->uzs, PaymentProvider::Wallet, idempotencyKey: 'order-1');

    expect($retry->id)->toBe($first->id)
        ->and($this->user->payments()->count())->toBe(1)
        ->and($this->user->wallets()->sole()->balance)->toBe(60_000);
});

test('a payable can be paid directly through a provider checkout, without the wallet', function () {
    $payment = $this->createPayment->handle($this->user, $this->cargo, 40_000, $this->uzs, PaymentProvider::Click);

    expect($payment->status)->toBe(PaymentStatus::Pending)
        ->and($payment->checkout_url)->toStartWith('https://my.click.uz/services/pay?')
        ->and($this->cargo->fresh()->times_paid)->toBe(0)
        ->and($this->user->wallets()->count())->toBe(0);
});

test('a wallet cannot be topped up from itself', function () {
    $wallet = fundedWallet($this->user, 100_000);

    expect(fn () => $this->createPayment->handle($this->user, $wallet, 10_000, $this->uzs, PaymentProvider::Wallet))
        ->toThrow(PaymentException::class);
});

test('a zero amount is refused', function () {
    expect(fn () => $this->createPayment->handle($this->user, $this->cargo, 0, $this->uzs, PaymentProvider::Click))
        ->toThrow(PaymentException::class);
});
