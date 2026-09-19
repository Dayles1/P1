<?php

use App\Domain\Currency\Actions\SyncExchangeRates;
use App\Domain\Currency\Exceptions\ExchangeRateProviderException;
use App\Domain\Currency\Models\Currency;
use App\Domain\Currency\Models\ExchangeRate;
use App\Domain\Currency\Services\CurrencyConverter;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

/**
 * One provider response.
 *
 * @param  array<string, float|int|string>  $rates
 * @return array<string, mixed>
 */
function ratePayload(array $rates, ?Carbon $publishedAt = null, string $base = 'USD'): array
{
    return [
        'result' => 'success',
        'base_code' => $base,
        'time_last_update_unix' => ($publishedAt ?? Carbon::now())->getTimestamp(),
        'rates' => $rates,
    ];
}

/**
 * Stacked `Http::fake()` calls keep the first match, so a test that
 * syncs twice has to queue both answers up front.
 *
 * @param  array<string, mixed>  ...$payloads
 */
function fakeRates(array ...$payloads): void
{
    $sequence = Http::fakeSequence('open.er-api.com/*');

    foreach ($payloads as $payload) {
        $sequence->push($payload);
    }
}

beforeEach(function () {
    currencyRow('USD');
    currencyRow('UZS');
    currencyRow('EUR');
});

test('a sync writes one rate per currency for the day the provider published', function () {
    $published = Carbon::parse('2026-09-18 00:02:31', 'UTC');

    fakeRates(ratePayload(['USD' => 1, 'UZS' => 11830.375889, 'EUR' => 0.871262], $published));

    $result = app(SyncExchangeRates::class)->handle();

    expect($result->ratesSynced)->toBe(3)
        ->and($result->baseCode)->toBe('USD')
        ->and($result->rateDate->toDateString())->toBe('2026-09-18')
        ->and(ExchangeRate::query()->count())->toBe(3);

    $uzs = ExchangeRate::query()
        ->whereRelation('currency', 'code', 'UZS')
        ->first();

    expect($uzs->rate_date->toDateString())->toBe('2026-09-18')
        ->and($uzs->base_code)->toBe('USD')
        ->and((float) $uzs->rate)->toBe(11830.375889)
        ->and($uzs->source)->toBe('open.er-api.com');
});

/*
 * The day is taken from the payload, not from the clock here: a sync
 * that runs a minute after midnight must not file yesterday's published
 * rates under today.
 */
test('the rate date comes from the payload, not from when the sync ran', function () {
    Carbon::setTestNow(Carbon::parse('2026-09-19 00:01:00', 'UTC'));

    fakeRates(ratePayload(['USD' => 1, 'UZS' => 11830.375889], Carbon::parse('2026-09-18 00:02:31', 'UTC')));

    app(SyncExchangeRates::class)->handle();

    expect(ExchangeRate::query()->first()->rate_date->toDateString())->toBe('2026-09-18');

    Carbon::setTestNow();
});

test('running twice in a day corrects that day rather than adding a second row', function () {
    $published = Carbon::parse('2026-09-18 00:02:31', 'UTC');

    fakeRates(
        ratePayload(['UZS' => 11830.375889], $published),
        ratePayload(['UZS' => 11900.5], $published),
    );

    app(SyncExchangeRates::class)->handle();
    app(SyncExchangeRates::class)->handle();

    expect(ExchangeRate::query()->count())->toBe(1)
        ->and((float) ExchangeRate::query()->first()->rate)->toBe(11900.5);
});

test('yesterday is left alone when today is synced', function () {
    fakeRates(
        ratePayload(['UZS' => 11000], Carbon::parse('2026-09-17 00:02:31', 'UTC')),
        ratePayload(['UZS' => 11830.375889], Carbon::parse('2026-09-18 00:02:31', 'UTC')),
    );

    app(SyncExchangeRates::class)->handle();
    app(SyncExchangeRates::class)->handle();

    expect(ExchangeRate::query()->count())->toBe(2);

    $converter = app(CurrencyConverter::class);
    $converter->forget();

    expect($converter->convert(1, 'USD', 'UZS', Carbon::parse('2026-09-17')))->toBe('11000.00')
        ->and($converter->convert(1, 'USD', 'UZS', Carbon::parse('2026-09-18')))->toBe('11830.38');
});

test('a currency the catalogue has never heard of is taken in rather than dropped', function () {
    fakeRates(ratePayload(['USD' => 1, 'ZZZ' => 42.5]));

    $result = app(SyncExchangeRates::class)->handle();

    expect($result->createdCurrencyCodes)->toBe(['ZZZ'])
        ->and(Currency::query()->byCode('ZZZ')->exists())->toBeTrue()
        ->and($result->ratesSynced)->toBe(2);
});

test('an unusable payload is refused, leaving the rates already stored in place', function () {
    fakeRates(
        ratePayload(['UZS' => 11830.375889]),
        ['result' => 'error', 'error-type' => 'unsupported-code'],
    );

    app(SyncExchangeRates::class)->handle();

    expect(fn () => app(SyncExchangeRates::class)->handle())
        ->toThrow(ExchangeRateProviderException::class);

    expect(ExchangeRate::query()->count())->toBe(1);
});

test('a provider that answers with nothing usable is refused too', function () {
    fakeRates(ratePayload([]));

    expect(fn () => app(SyncExchangeRates::class)->handle())
        ->toThrow(ExchangeRateProviderException::class);
});

test('a provider quoting the wrong base is refused, not stored as if it were ours', function () {
    fakeRates(ratePayload(['EUR' => 1, 'USD' => 1.15], base: 'EUR'));

    expect(fn () => app(SyncExchangeRates::class)->handle())
        ->toThrow(ExchangeRateProviderException::class);
});

test('the sync command reports what it stored', function () {
    fakeRates(ratePayload(['USD' => 1, 'UZS' => 11830.375889], Carbon::parse('2026-09-18 00:02:31', 'UTC')));

    $this->artisan('currency:sync')
        ->expectsOutputToContain('2 rates against USD for 2026-09-18')
        ->assertExitCode(0);
});

test('the sync command fails loudly instead of pretending it worked', function () {
    config(['currency.provider.retries' => 1]);

    Http::fake([
        'open.er-api.com/*' => Http::response(status: 503),
    ]);

    $this->artisan('currency:sync')->assertExitCode(1);
});
