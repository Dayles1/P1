<?php

use App\Domain\Currency\Services\CurrencyConverter;
use App\Domain\Identity\Models\User;
use App\Domain\Setting\Models\Setting;
use Tests\TestCase;

beforeEach(function () {
    currencyRow('USD');
    rateRow('UZS', '11830.375889');
    rateRow('EUR', '0.871262');
    rateRow('GBP', '0.75');

    app(CurrencyConverter::class)->forget();

    $this->user = User::factory()->create();
    $this->token = $this->user->createToken('test')->plainTextToken;
});

function asUser(): TestCase
{
    return test()->withHeader('Authorization', 'Bearer '.test()->token);
}

test('a user starts with no pinned currencies', function () {
    asUser()->getJson('/api/profile/favorite-currencies')
        ->assertOk()
        ->assertJsonCount(0, 'data')
        ->assertJsonPath('max', 10);
});

test('pinning currencies keeps the order they were given in', function () {
    $uzs = currencyRow('UZS');
    $eur = currencyRow('EUR');
    $gbp = currencyRow('GBP');

    asUser()->putJson('/api/profile/favorite-currencies', [
        'favorite_currency_ids' => [$gbp->id, $uzs->id, $eur->id],
    ])
        ->assertOk()
        ->assertJsonPath('data.0.code', 'GBP')
        ->assertJsonPath('data.1.code', 'UZS')
        ->assertJsonPath('data.2.code', 'EUR');

    expect($this->user->settings()->first()->favorite_currency_ids)
        ->toBe([$gbp->id, $uzs->id, $eur->id]);
});

test('a pinned currency is quoted against the currency the user reads prices in', function () {
    $this->user->settings()->create([
        'user_id' => $this->user->id,
        'preferred_currency_id' => currencyRow('UZS')->id,
        'favorite_currency_ids' => [currencyRow('EUR')->id],
    ]);

    $response = asUser()->getJson('/api/profile/favorite-currencies')->assertOk();

    expect($response->json('data.0.quote.from'))->toBe('UZS')
        ->and($response->json('data.0.quote.to'))->toBe('EUR')
        // 1 UZS buys very little of a euro; a euro buys a lot of som.
        ->and($response->json('data.0.quote.inverse_rate'))->toBe('13578.44');
});

test('a currency that has since been switched off drops out of the list', function () {
    $eur = currencyRow('EUR');
    $gbp = currencyRow('GBP');

    $this->user->settings()->create([
        'user_id' => $this->user->id,
        'favorite_currency_ids' => [$eur->id, $gbp->id],
    ]);

    $gbp->update(['is_active' => false]);

    asUser()->getJson('/api/profile/favorite-currencies')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.code', 'EUR');
});

test('the list can be emptied', function () {
    $this->user->settings()->create([
        'user_id' => $this->user->id,
        'favorite_currency_ids' => [currencyRow('EUR')->id],
    ]);

    asUser()->putJson('/api/profile/favorite-currencies', ['favorite_currency_ids' => []])
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

test('pinning more than the configured maximum is rejected', function () {
    Setting::query()->byKey('user.max_favorite_currency_count')->update(['value' => 2]);

    asUser()->putJson('/api/profile/favorite-currencies', [
        'favorite_currency_ids' => [
            currencyRow('UZS')->id,
            currencyRow('EUR')->id,
            currencyRow('GBP')->id,
        ],
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('favorite_currency_ids');
});

test('the same currency cannot be pinned twice', function () {
    $eur = currencyRow('EUR');

    asUser()->putJson('/api/profile/favorite-currencies', [
        'favorite_currency_ids' => [$eur->id, $eur->id],
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('favorite_currency_ids.0');
});

test('a currency that does not exist cannot be pinned', function () {
    asUser()->putJson('/api/profile/favorite-currencies', [
        'favorite_currency_ids' => [99999],
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('favorite_currency_ids.0');
});

test('pinned currencies are private to the user who pinned them', function () {
    $this->getJson('/api/profile/favorite-currencies')->assertUnauthorized();
    $this->putJson('/api/profile/favorite-currencies', ['favorite_currency_ids' => []])
        ->assertUnauthorized();
});
