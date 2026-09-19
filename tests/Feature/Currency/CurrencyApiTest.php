<?php

use App\Domain\Currency\Services\CurrencyConverter;
use App\Domain\Identity\Models\User;
use Illuminate\Support\Carbon;

beforeEach(function () {
    currencyRow('USD', symbol: '$');
    rateRow('UZS', '11830.375889');
    rateRow('EUR', '0.871262');

    app(CurrencyConverter::class)->forget();
});

test('the currency list says which currency is the app one', function () {
    $this->getJson('/api/currencies')
        ->assertOk()
        ->assertJsonPath('base_code', 'USD')
        ->assertJsonPath('preferred_code', 'USD')
        ->assertJsonPath('rates_as_of', Carbon::today()->toDateString())
        ->assertJsonPath('data.0.code', 'EUR')
        ->assertJsonCount(3, 'data');
});

test('a currency that is switched off is not offered', function () {
    currencyRow('OLD')->update(['is_active' => false]);

    $this->getJson('/api/currencies')
        ->assertOk()
        ->assertJsonMissing(['code' => 'OLD']);
});

test('the list tells a signed-in user which currency is theirs', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $user->settings()->create([
        'user_id' => $user->id,
        'preferred_currency_id' => currencyRow('UZS')->id,
    ]);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/currencies')
        ->assertOk()
        ->assertJsonPath('base_code', 'USD')
        ->assertJsonPath('preferred_code', 'UZS');
});

test('the rate table is the day rates, against the app currency', function () {
    $response = $this->getJson('/api/exchange-rates')
        ->assertOk()
        ->assertJsonPath('base_code', 'USD')
        ->assertJsonPath('as_of', Carbon::today()->toDateString());

    $uzs = collect($response->json('data'))->firstWhere('currency.code', 'UZS');

    expect($uzs['base_code'])->toBe('USD')
        ->and((float) $uzs['rate'])->toBe(11830.375889)
        ->and($uzs['rate_date'])->toBe(Carbon::today()->toDateString());
});

test('the rate table can be asked what a rate was on a past day', function () {
    $then = Carbon::today()->subDays(2);

    rateRow('UZS', '9000', $then->toDateString());

    $response = $this->getJson('/api/exchange-rates?date='.$then->toDateString())
        ->assertOk()
        ->assertJsonPath('as_of', $then->toDateString());

    $uzs = collect($response->json('data'))->firstWhere('currency.code', 'UZS');

    expect((float) $uzs['rate'])->toBe(9000.0);
});

test('a malformed date is rejected rather than silently meaning today', function () {
    $this->getJson('/api/exchange-rates?date=yesterday')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('date');
});

test('the convert endpoint converts at the current rate', function () {
    $this->getJson('/api/currencies/convert?amount=100&from=EUR&to=UZS')
        ->assertOk()
        ->assertJsonPath('data.amount', '100.00')
        ->assertJsonPath('data.from', 'EUR')
        ->assertJsonPath('data.to', 'UZS')
        ->assertJsonPath('data.converted', '1357843.67')
        ->assertJsonPath('data.as_of', Carbon::today()->toDateString());
});

test('the convert endpoint takes a lowercase code', function () {
    $this->getJson('/api/currencies/convert?amount=1&from=usd&to=uzs')
        ->assertOk()
        ->assertJsonPath('data.converted', '11830.38');
});

test('the convert endpoint converts at a past day rate when asked', function () {
    $then = Carbon::today()->subDay();

    rateRow('UZS', '9000', $then->toDateString());

    $this->getJson('/api/currencies/convert?amount=1&from=USD&to=UZS&date='.$then->toDateString())
        ->assertOk()
        ->assertJsonPath('data.converted', '9000.00');
});

test('converting to a currency the app does not have is a validation error', function () {
    $this->getJson('/api/currencies/convert?amount=1&from=USD&to=ZZZ')
        ->assertUnprocessable()
        ->assertJsonValidationErrors('to');
});

test('converting a currency with no rate says so instead of returning a number', function () {
    currencyRow('XYZ');

    $this->getJson('/api/currencies/convert?amount=1&from=USD&to=XYZ')
        ->assertUnprocessable()
        ->assertJsonPath('success', false);
});
