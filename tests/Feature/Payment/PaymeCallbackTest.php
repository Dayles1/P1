<?php

use App\Domain\Identity\Models\User;
use App\Domain\Payment\Actions\CreatePayment;
use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Enums\PaymentStatus;
use App\Domain\Wallet\Models\Wallet;
use Illuminate\Support\Carbon;

beforeEach(function () {
    configurePaymentProviders();

    $this->user = User::factory()->create();
    $this->uzs = currencyRow('UZS');
    $this->wallet = Wallet::resolveFor($this->user, $this->uzs);

    // 1 500.00 sum = 150 000 tiyin
    $this->payment = app(CreatePayment::class)->handle(
        $this->user, $this->wallet, 150_000, $this->uzs, PaymentProvider::Payme
    );

    $this->payme = function (string $method, array $params, string $key = 'payme-key') {
        return $this->withHeader('Authorization', 'Basic '.base64_encode("Paycom:{$key}"))
            ->postJson('/api/payments/callback/payme', ['id' => 1, 'method' => $method, 'params' => $params]);
    };

    $this->account = ['payment_id' => $this->payment->uuid];
});

test('the checkout link encodes the merchant, the order and the amount in tiyin', function () {
    $encoded = substr($this->payment->checkout_url, strlen('https://checkout.paycom.uz/'));

    expect(base64_decode($encoded))->toBe(
        "m=payme-merchant;ac.payment_id={$this->payment->uuid};a=150000;c=https://app.test/payments/{$this->payment->uuid}"
    );
});

test('the full create and perform flow credits the wallet once', function () {
    ($this->payme)('CheckPerformTransaction', ['amount' => 150_000, 'account' => $this->account])
        ->assertJsonPath('result.allow', true);

    $time = (int) now()->getPreciseTimestamp(3);

    ($this->payme)('CreateTransaction', ['id' => 'payme-tx-1', 'time' => $time, 'amount' => 150_000, 'account' => $this->account])
        ->assertJsonPath('result.state', 1)
        ->assertJsonPath('result.create_time', $time)
        ->assertJsonPath('result.transaction', (string) $this->payment->id);

    $perform = ($this->payme)('PerformTransaction', ['id' => 'payme-tx-1'])
        ->assertJsonPath('result.state', 2);

    // Payme retries PerformTransaction: same answer, no second credit.
    ($this->payme)('PerformTransaction', ['id' => 'payme-tx-1'])
        ->assertJsonPath('result.state', 2)
        ->assertJsonPath('result.perform_time', $perform->json('result.perform_time'));

    ($this->payme)('CheckTransaction', ['id' => 'payme-tx-1'])
        ->assertJsonPath('result.state', 2)
        ->assertJsonPath('result.create_time', $time)
        ->assertJsonPath('result.cancel_time', 0);

    expect($this->payment->fresh()->status)->toBe(PaymentStatus::Succeeded)
        ->and($this->wallet->fresh()->balance)->toBe(150_000)
        ->and($this->wallet->transactions()->count())->toBe(1);
});

test('a repeated CreateTransaction answers with the same transaction', function () {
    $params = ['id' => 'payme-tx-1', 'time' => 1_000, 'amount' => 150_000, 'account' => $this->account];

    Carbon::setTestNow(Carbon::createFromTimestampMs(2_000));

    ($this->payme)('CreateTransaction', $params)->assertJsonPath('result.state', 1);
    ($this->payme)('CreateTransaction', $params)
        ->assertJsonPath('result.state', 1)
        ->assertJsonPath('result.create_time', 1_000);
});

test('a second transaction for an order that already has one is refused', function () {
    ($this->payme)('CreateTransaction', ['id' => 'payme-tx-1', 'time' => now()->getPreciseTimestamp(3), 'amount' => 150_000, 'account' => $this->account]);

    ($this->payme)('CreateTransaction', ['id' => 'payme-tx-2', 'time' => now()->getPreciseTimestamp(3), 'amount' => 150_000, 'account' => $this->account])
        ->assertJsonPath('error.code', -31099);
});

test('wrong credentials are refused', function () {
    ($this->payme)('CheckPerformTransaction', ['amount' => 150_000, 'account' => $this->account], 'wrong-key')
        ->assertJsonPath('error.code', -32504);
});

test('a wrong amount and an unknown order are reported with their own codes', function () {
    ($this->payme)('CheckPerformTransaction', ['amount' => 100, 'account' => $this->account])
        ->assertJsonPath('error.code', -31001);

    ($this->payme)('CheckPerformTransaction', ['amount' => 150_000, 'account' => ['payment_id' => 'nope']])
        ->assertJsonPath('error.code', -31050)
        ->assertJsonPath('error.data', 'payment_id');
});

test('a created transaction can be cancelled, and then cannot be performed', function () {
    ($this->payme)('CreateTransaction', ['id' => 'payme-tx-1', 'time' => now()->getPreciseTimestamp(3), 'amount' => 150_000, 'account' => $this->account]);

    ($this->payme)('CancelTransaction', ['id' => 'payme-tx-1', 'reason' => 3])
        ->assertJsonPath('result.state', -1);

    ($this->payme)('CancelTransaction', ['id' => 'payme-tx-1', 'reason' => 3])
        ->assertJsonPath('result.state', -1);

    ($this->payme)('PerformTransaction', ['id' => 'payme-tx-1'])
        ->assertJsonPath('error.code', -31008);

    ($this->payme)('CheckTransaction', ['id' => 'payme-tx-1'])
        ->assertJsonPath('result.reason', 3);

    expect($this->payment->fresh()->status)->toBe(PaymentStatus::Cancelled)
        ->and($this->wallet->fresh()->balance)->toBe(0);
});

test('a performed transaction cannot be cancelled', function () {
    ($this->payme)('CreateTransaction', ['id' => 'payme-tx-1', 'time' => now()->getPreciseTimestamp(3), 'amount' => 150_000, 'account' => $this->account]);
    ($this->payme)('PerformTransaction', ['id' => 'payme-tx-1']);

    ($this->payme)('CancelTransaction', ['id' => 'payme-tx-1', 'reason' => 5])
        ->assertJsonPath('error.code', -31007);

    expect($this->wallet->fresh()->balance)->toBe(150_000);
});

test('a transaction older than twelve hours is cancelled instead of performed', function () {
    $created = now()->subHours(13);

    ($this->payme)('CreateTransaction', ['id' => 'payme-tx-1', 'time' => $created->getPreciseTimestamp(3), 'amount' => 150_000, 'account' => $this->account]);

    ($this->payme)('PerformTransaction', ['id' => 'payme-tx-1'])
        ->assertJsonPath('error.code', -31008);

    ($this->payme)('CheckTransaction', ['id' => 'payme-tx-1'])
        ->assertJsonPath('result.state', -1)
        ->assertJsonPath('result.reason', 4);

    expect($this->wallet->fresh()->balance)->toBe(0);
});

test('an unknown transaction and an unknown method are reported', function () {
    ($this->payme)('PerformTransaction', ['id' => 'nope'])->assertJsonPath('error.code', -31003);
    ($this->payme)('DoSomething', [])->assertJsonPath('error.code', -32601);
});

test('the statement lists transactions created in the period', function () {
    $time = (int) now()->getPreciseTimestamp(3);

    ($this->payme)('CreateTransaction', ['id' => 'payme-tx-1', 'time' => $time, 'amount' => 150_000, 'account' => $this->account]);

    ($this->payme)('GetStatement', ['from' => $time - 1_000, 'to' => $time + 1_000])
        ->assertJsonCount(1, 'result.transactions')
        ->assertJsonPath('result.transactions.0.id', 'payme-tx-1')
        ->assertJsonPath('result.transactions.0.amount', 150_000)
        ->assertJsonPath('result.transactions.0.account.payment_id', $this->payment->uuid);

    ($this->payme)('GetStatement', ['from' => $time + 1_000, 'to' => $time + 2_000])
        ->assertJsonCount(0, 'result.transactions');
});
