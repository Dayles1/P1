<?php

use App\Domain\Identity\Models\User;
use App\Domain\Payment\Actions\CreatePayment;
use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Enums\PaymentStatus;
use App\Domain\Wallet\Models\Wallet;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    configurePaymentProviders();

    Http::fake([
        'api.oneqr.test/invoices' => Http::response(['id' => 'inv-1', 'payment_url' => 'https://pay.oneqr.test/inv-1']),
    ]);

    $this->user = User::factory()->create();
    $this->uzs = currencyRow('UZS');
    $this->wallet = Wallet::resolveFor($this->user, $this->uzs);

    $this->payment = app(CreatePayment::class)->handle(
        $this->user, $this->wallet, 150_000, $this->uzs, PaymentProvider::OneQr
    );

    $this->notify = function (array $payload, ?string $signature = null) {
        $body = json_encode($payload);

        return $this->call(
            'POST',
            '/api/payments/callback/oneqr',
            server: [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_X_SIGNATURE' => $signature ?? hash_hmac('sha256', $body, 'oneqr-secret'),
            ],
            content: $body,
        );
    };
});

test('an invoice is created and its link returned as the checkout', function () {
    expect($this->payment->checkout_url)->toBe('https://pay.oneqr.test/inv-1')
        ->and($this->payment->provider_transaction_id)->toBe('inv-1');

    Http::assertSent(fn (Request $request) => $request['order_id'] === $this->payment->uuid
        && $request['amount'] === '1500.00'
        && $request->hasHeader('Authorization', 'Bearer oneqr-key'));
});

test('a signed paid notification credits the wallet, and a replay does not credit it again', function () {
    $payload = ['order_id' => $this->payment->uuid, 'status' => 'paid', 'amount' => '1500.00', 'transaction_id' => 'qr-tx-1'];

    ($this->notify)($payload)->assertOk()->assertJson(['success' => true]);
    ($this->notify)($payload)->assertOk();

    expect($this->payment->fresh()->status)->toBe(PaymentStatus::Succeeded)
        ->and($this->payment->fresh()->provider_transaction_id)->toBe('qr-tx-1')
        ->and($this->wallet->fresh()->balance)->toBe(150_000)
        ->and($this->wallet->transactions()->count())->toBe(1);
});

test('an unsigned notification is refused', function () {
    ($this->notify)(['order_id' => $this->payment->uuid, 'status' => 'paid', 'amount' => '1500.00'], 'bad')
        ->assertUnauthorized();

    expect($this->wallet->fresh()->balance)->toBe(0);
});

test('a late failure cannot undo a payment that succeeded', function () {
    ($this->notify)(['order_id' => $this->payment->uuid, 'status' => 'paid', 'amount' => '1500.00']);
    ($this->notify)(['order_id' => $this->payment->uuid, 'status' => 'failed', 'amount' => '1500.00']);

    expect($this->payment->fresh()->status)->toBe(PaymentStatus::Succeeded)
        ->and($this->wallet->fresh()->balance)->toBe(150_000);
});
