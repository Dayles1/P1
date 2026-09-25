<?php

use App\Domain\Identity\Models\User;
use App\Domain\Payment\Actions\CreatePayment;
use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Models\Card;
use App\Domain\Wallet\Enums\WalletTransactionType;
use App\Domain\Wallet\Models\Wallet;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    configurePaymentProviders();

    $this->user = User::factory()->create();
    [$this->token] = createUserSession($this->user);
    $this->uzs = currencyRow('UZS');

    $this->api = fn () => $this->withHeader('Authorization', "Bearer {$this->token}");
});

test('a top-up through a checkout answers with the link and leaves the wallet untouched until paid', function () {
    ($this->api)()->postJson('/api/wallets/top-up', [
        'currency_code' => 'uzs',
        'amount' => '50000.50',
        'provider' => 'payme',
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.provider', 'payme')
        ->assertJsonPath('data.amount', '50000.50')
        ->assertJsonPath('data.amount_minor', 5_000_050)
        ->assertJsonPath('data.currency_code', 'UZS')
        ->assertJsonPath('data.payable.type', 'wallet')
        ->assertJsonPath('data.checkout_url', fn (string $url) => str_starts_with($url, 'https://checkout.paycom.uz/'));

    expect($this->user->wallets()->sole()->balance)->toBe(0);
});

test('a retried top-up with the same idempotency key does not create a second payment', function () {
    $body = ['currency_code' => 'UZS', 'amount' => '1000', 'provider' => 'click', 'idempotency_key' => 'k-1'];

    $first = ($this->api)()->postJson('/api/wallets/top-up', $body)->assertCreated()->json('data.id');
    $second = ($this->api)()->postJson('/api/wallets/top-up', $body)->assertCreated()->json('data.id');

    expect($second)->toBe($first)
        ->and($this->user->payments()->count())->toBe(1);
});

test('a top-up with a saved card is charged at once and credits the wallet', function () {
    Http::fake([
        'api.click.uz/v2/merchant/card_token/payment' => Http::response([
            'error_code' => 0, 'error_note' => 'Success', 'payment_id' => 98765, 'payment_status' => 2,
        ]),
    ]);

    $card = Card::query()->create([
        'user_id' => $this->user->id,
        'provider' => PaymentProvider::Click,
        'token' => 'click-card-token',
        'masked_pan' => '860006******1234',
        'verified_at' => now(),
    ]);

    ($this->api)()->postJson('/api/wallets/top-up', [
        'currency_code' => 'UZS', 'amount' => '25000', 'provider' => 'click', 'card_id' => $card->id,
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'succeeded')
        ->assertJsonPath('data.checkout_url', null)
        ->assertJsonPath('data.card.masked_pan', '860006******1234');

    Http::assertSent(fn (Request $request) => $request['card_token'] === 'click-card-token'
        && $request['amount'] === '25000.00'
        && $request->hasHeader('Auth'));

    $wallet = $this->user->wallets()->sole();

    expect($wallet->balance)->toBe(2_500_000)
        ->and($wallet->transactions()->sole()->type)->toBe(WalletTransactionType::Deposit)
        ->and($this->user->payments()->sole()->provider_transaction_id)->toBe('98765');
});

test('a card the provider declines fails the payment without crediting', function () {
    Http::fake([
        'checkout.paycom.uz/api' => Http::sequence()
            ->push(['result' => ['receipt' => ['_id' => 'rcpt-1', 'state' => 0]]])
            ->push(['error' => ['code' => -31630, 'message' => 'Insufficient funds']]),
    ]);

    $card = Card::query()->create([
        'user_id' => $this->user->id,
        'provider' => PaymentProvider::Payme,
        'token' => 'payme-card-token',
        'masked_pan' => '860006******1234',
        'verified_at' => now(),
    ]);

    ($this->api)()->postJson('/api/wallets/top-up', [
        'currency_code' => 'UZS', 'amount' => '25000', 'provider' => 'payme', 'card_id' => $card->id,
    ])
        ->assertCreated()
        ->assertJsonPath('data.status', 'failed')
        ->assertJsonPath('data.failure_reason', 'Insufficient funds');

    expect($this->user->wallets()->sole()->balance)->toBe(0);
});

test("someone else's card cannot be used", function () {
    $card = Card::query()->create([
        'user_id' => User::factory()->create()->id,
        'provider' => PaymentProvider::Click,
        'token' => 't',
        'masked_pan' => '860006******1234',
        'verified_at' => now(),
    ]);

    ($this->api)()->postJson('/api/wallets/top-up', [
        'currency_code' => 'UZS', 'amount' => '1000', 'provider' => 'click', 'card_id' => $card->id,
    ])->assertUnprocessable()->assertJsonValidationErrors('card_id');
});

test('the wallet itself is not a top-up provider, and a provider refuses currencies it does not take', function () {
    ($this->api)()->postJson('/api/wallets/top-up', ['currency_code' => 'UZS', 'amount' => '1000', 'provider' => 'wallet'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('provider');

    currencyRow('USD');

    ($this->api)()->postJson('/api/wallets/top-up', ['currency_code' => 'USD', 'amount' => '10', 'provider' => 'click'])
        ->assertUnprocessable()
        ->assertJsonPath('success', false);
});

test('wallets and their ledger are listed for their owner only', function () {
    $wallet = fundedWallet($this->user, 150_000);
    $foreign = fundedWallet(User::factory()->create(), 1);

    ($this->api)()->getJson('/api/wallets')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.balance', '1500.00')
        ->assertJsonPath('data.0.currency.code', 'UZS');

    ($this->api)()->getJson("/api/wallets/{$wallet->id}/transactions")
        ->assertOk()
        ->assertJsonPath('data.0.type', 'adjustment')
        ->assertJsonPath('data.0.amount', '1500.00')
        ->assertJsonPath('data.0.balance_after', '1500.00')
        ->assertJsonPath('pagination.total', 1);

    ($this->api)()->getJson("/api/wallets/{$foreign->id}/transactions")->assertNotFound();
});

test('a payment can be polled by its owner only', function () {
    $id = ($this->api)()->postJson('/api/wallets/top-up', ['currency_code' => 'UZS', 'amount' => '1000', 'provider' => 'click'])
        ->json('data.id');

    $other = User::factory()->create();
    $foreign = app(CreatePayment::class)->handle(
        $other, Wallet::resolveFor($other, $this->uzs), 100_000, $this->uzs, PaymentProvider::Click
    );

    ($this->api)()->getJson("/api/payments/{$id}")->assertOk()->assertJsonPath('data.status', 'pending');
    ($this->api)()->getJson('/api/payments')->assertOk()->assertJsonPath('pagination.total', 1);
    ($this->api)()->getJson("/api/payments/{$foreign->uuid}")->assertNotFound();
});

test('wallet and payment endpoints require authentication', function () {
    $this->getJson('/api/wallets')->assertUnauthorized();
    $this->postJson('/api/wallets/top-up')->assertUnauthorized();
    $this->getJson('/api/payments')->assertUnauthorized();
    $this->getJson('/api/cards')->assertUnauthorized();
});
