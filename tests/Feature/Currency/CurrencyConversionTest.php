<?php

use App\Domain\Currency\Services\CurrencyConverter;
use App\Domain\Identity\Models\User;
use Illuminate\Support\Carbon;

/**
 * The converter is a singleton that memoises the rate table, so a test
 * writing rates after it has already read once has to say so.
 */
function converter(): CurrencyConverter
{
    $converter = app(CurrencyConverter::class);
    $converter->forget();

    return $converter;
}

beforeEach(function () {
    currencyRow('USD');
    rateRow('UZS', '11830.375889');
    rateRow('EUR', '0.871262');
    rateRow('JPY', '147.5', decimals: 0);
});

test('the app currency is the one settings names', function () {
    expect(converter()->baseCode())->toBe('USD');
});

test('the app currency is always worth one of itself, rate row or not', function () {
    expect(converter()->rateFor('USD'))->toBe('1');
});

test('converting from the app currency uses the stored rate', function () {
    expect(converter()->convert(1, 'USD', 'UZS'))->toBe('11830.38');
});

test('converting to the app currency inverts it', function () {
    // 118303.75889 UZS is 10 USD at that rate.
    expect(converter()->convert('118303.75889', 'UZS', 'USD'))->toBe('10.00');
});

test('converting between two non-app currencies goes through the app currency', function () {
    // 100 EUR -> USD -> UZS: (100 / 0.871262) * 11830.375889
    expect(converter()->convert(100, 'EUR', 'UZS'))->toBe('1357843.67');
});

test('a result is rounded to the decimals its currency is written with', function () {
    $converter = converter();

    // JPY is a 0-decimal currency, EUR a 2-decimal one.
    expect($converter->convert(100, 'USD', 'JPY'))->toBe('14750')
        ->and($converter->convert(100, 'USD', 'EUR'))->toBe('87.13');
});

test('an amount in its own currency comes back untouched but rounded', function () {
    expect(converter()->convert('10.005', 'EUR', 'EUR'))->toBe('10.01');
});

test('rounding is half up, not truncation', function () {
    $converter = converter();

    expect($converter->round('1.005', 2))->toBe('1.01')
        ->and($converter->round('1.004', 2))->toBe('1.00')
        ->and($converter->round('-1.005', 2))->toBe('-1.01');
});

test('a currency with no rate cannot be converted, rather than converting wrongly', function () {
    currencyRow('XYZ');

    $converter = converter();

    expect($converter->convert(1, 'USD', 'XYZ'))->toBeNull()
        ->and($converter->convert(1, 'XYZ', 'USD'))->toBeNull();
});

/*
 * The rate table is a day at a time, so "what was it worth then" is a
 * question the app can answer, and a day the sync missed is not a hole.
 */
test('a past day reads that day rate, not today', function () {
    $then = Carbon::today()->subDays(3);

    rateRow('UZS', '12500', $then->toDateString());

    $converter = converter();

    expect($converter->convert(1, 'USD', 'UZS', $then))->toBe('12500.00')
        ->and($converter->convert(1, 'USD', 'UZS'))->toBe('11830.38');
});

test('a day with no rates falls back to the last day that had them', function () {
    $asked = Carbon::today()->addDays(5);
    $converter = converter();

    expect($converter->convert(1, 'USD', 'UZS', $asked))->toBe('11830.38')
        ->and($converter->ratesAsOf($asked))->toBe(Carbon::today()->toDateString());
});

test('the fallback is per currency, so one stale currency does not stale the rest', function () {
    rateRow('GBP', '0.75', Carbon::yesterday()->toDateString());

    $converter = converter();

    expect($converter->convert(1, 'USD', 'GBP'))->toBe('0.75')
        ->and($converter->convert(1, 'USD', 'EUR'))->toBe('0.87');
});

test('a user reads prices in their own currency, or the app one when they have not chosen', function () {
    $user = User::factory()->create();

    expect(converter()->preferredCode($user))->toBe('USD')
        ->and(converter()->preferredCode(null))->toBe('USD');

    $user->settings()->create([
        'user_id' => $user->id,
        'preferred_currency_id' => currencyRow('UZS')->id,
    ]);

    expect(converter()->preferredCode($user->fresh()))->toBe('UZS');
});

test('a quote gives the rate both ways round with the day it is from', function () {
    $quote = converter()->quote('USD', 'EUR');

    expect($quote['from'])->toBe('USD')
        ->and($quote['to'])->toBe('EUR')
        ->and($quote['rate'])->toBe('0.87')
        ->and($quote['inverse_rate'])->toBe('1.15')
        ->and($quote['as_of'])->toBe(Carbon::today()->toDateString());
});
