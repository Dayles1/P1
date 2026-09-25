<?php

use App\Domain\Identity\Models\User;
use App\Domain\Payment\Actions\CreatePayment;
use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Enums\PaymentStatus;
use App\Domain\Payment\Models\Payment;
use App\Domain\Wallet\Models\Wallet;

beforeEach(function () {
    configurePaymentProviders();

    $this->user = User::factory()->create();
    $this->uzs = currencyRow('UZS');
    $this->wallet = Wallet::resolveFor($this->user, $this->uzs);

    // 1 500.00 sum
    $this->payment = app(CreatePayment::class)->handle(
        $this->user, $this->wallet, 150_000, $this->uzs, PaymentProvider::Click
    );
});

/**
 * A Shop API request as Click signs it.
 *
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function clickRequest(Payment $payment, int $action, array $overrides = []): array
{
    $params = array_merge([
        'click_trans_id' => '777001',
        'service_id' => '1001',
        'click_paydoc_id' => '555',
        'merchant_trans_id' => $payment->uuid,
        'amount' => '1500.00',
        'action' => (string) $action,
        'error' => '0',
        'error_note' => 'Success',
        'sign_time' => '2026-09-25 12:00:00',
    ], $action === 1 ? ['merchant_prepare_id' => (string) $payment->id] : [], $overrides);

    $params['sign_string'] ??= md5(
        $params['click_trans_id'].$params['service_id'].'click-secret'.$params['merchant_trans_id']
        .($action === 1 ? $params['merchant_prepare_id'] : '')
        .$params['amount'].$params['action'].$params['sign_time']
    );

    return $params;
}

test('the checkout link carries the service, amount in sum and the payment reference', function () {
    parse_str((string) parse_url($this->payment->checkout_url, PHP_URL_QUERY), $query);

    expect($query)->toMatchArray([
        'service_id' => '1001',
        'merchant_id' => '2002',
        'amount' => '1500.00',
        'transaction_param' => $this->payment->uuid,
        'return_url' => "https://app.test/payments/{$this->payment->uuid}",
    ]);
});

test('prepare then complete credits the wallet', function () {
    $this->post('/api/payments/callback/click', clickRequest($this->payment, 0))
        ->assertOk()
        ->assertJson(['error' => 0, 'merchant_prepare_id' => $this->payment->id]);

    $this->post('/api/payments/callback/click', clickRequest($this->payment, 1))
        ->assertOk()
        ->assertJson(['error' => 0, 'merchant_confirm_id' => $this->payment->id]);

    $payment = $this->payment->fresh();

    expect($payment->status)->toBe(PaymentStatus::Succeeded)
        ->and($payment->provider_transaction_id)->toBe('777001')
        ->and($this->wallet->fresh()->balance)->toBe(150_000)
        ->and($this->wallet->transactions()->count())->toBe(1);
});

test('a retried complete answers the same and credits nothing more', function () {
    $this->post('/api/payments/callback/click', clickRequest($this->payment, 0));
    $this->post('/api/payments/callback/click', clickRequest($this->payment, 1))->assertJson(['error' => 0]);
    $this->post('/api/payments/callback/click', clickRequest($this->payment, 1))->assertJson(['error' => 0]);

    expect($this->wallet->fresh()->balance)->toBe(150_000)
        ->and($this->wallet->transactions()->count())->toBe(1);
});

test('another click transaction for an already paid order is refused', function () {
    $this->post('/api/payments/callback/click', clickRequest($this->payment, 1));

    $this->post('/api/payments/callback/click', clickRequest($this->payment, 1, ['click_trans_id' => '777002']))
        ->assertJson(['error' => -4]);

    expect($this->wallet->fresh()->balance)->toBe(150_000);
});

test('a forged signature is rejected and changes nothing', function () {
    $this->post('/api/payments/callback/click', clickRequest($this->payment, 1, ['sign_string' => md5('forged')]))
        ->assertJson(['error' => -1]);

    expect($this->payment->fresh()->status)->toBe(PaymentStatus::Pending)
        ->and($this->wallet->fresh()->balance)->toBe(0);
});

test('a different amount is rejected', function () {
    $this->post('/api/payments/callback/click', clickRequest($this->payment, 0, ['amount' => '1.00']))
        ->assertJson(['error' => -2]);
});

test('an unknown order is reported as not found', function () {
    $this->post('/api/payments/callback/click', clickRequest($this->payment, 0, ['merchant_trans_id' => '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d']))
        ->assertJson(['error' => -5]);
});

test('a failed payment on click side cancels the payment without crediting', function () {
    $this->post('/api/payments/callback/click', clickRequest($this->payment, 1, ['error' => '-5017', 'error_note' => 'Insufficient funds']))
        ->assertJson(['error' => -9]);

    expect($this->payment->fresh()->status)->toBe(PaymentStatus::Failed)
        ->and($this->wallet->fresh()->balance)->toBe(0);
});

test('a callback for an unknown provider is not found', function () {
    $this->post('/api/payments/callback/wallet', [])->assertNotFound();
    $this->post('/api/payments/callback/nope', [])->assertNotFound();
});
