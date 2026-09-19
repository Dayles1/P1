<?php

use App\Domain\Currency\Exceptions\UnknownCurrencyException;
use App\Domain\Currency\Services\CurrencyConverter;
use App\Domain\Price\Models\Price;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;
use Tests\Fixtures\PriceableStub;

beforeEach(function () {
    Schema::create('priceable_stubs', function (Blueprint $table) {
        $table->id();
        $table->string('name')->nullable();
        $table->timestamps();
    });

    currencyRow('USD');
    rateRow('UZS', '11830.375889');
    rateRow('EUR', '0.871262');
    rateRow('JPY', '147.5', decimals: 0);

    app(CurrencyConverter::class)->forget();

    $this->item = PriceableStub::create(['name' => 'A thing']);
});

test('a price is kept in the currency it was set in', function () {
    $price = $this->item->setPrice('1500000', 'UZS');

    expect($price->currency_code)->toBe('UZS')
        ->and($price->amount)->toBe('1500000.0000')
        ->and($price->is_active)->toBeTrue()
        ->and($price->type)->toBe(Price::TYPE_REGULAR);
});

test('the same price reads out in every other currency', function () {
    $this->item->setPrice('1500000', 'UZS');

    expect($this->item->priceIn('UZS'))->toBe('1500000.00')
        ->and($this->item->priceIn('USD'))->toBe('126.79')
        ->and($this->item->priceIn('EUR'))->toBe('110.47')
        ->and($this->item->priceIn('JPY'))->toBe('18702');
});

/*
 * The point of the whole design: what the owner asked for is a fact
 * about the price, not a function of today's market.
 */
test('the market moving does not change what was asked for', function () {
    $price = $this->item->setPrice('100', 'USD');

    expect($this->item->priceIn('UZS'))->toBe('1183037.59');

    // The som halves overnight.
    rateRow('UZS', '23660.751778', Carbon::tomorrow()->toDateString());
    app(CurrencyConverter::class)->forget();

    Carbon::setTestNow(Carbon::tomorrow());

    expect($this->item->fresh()->activePrice()->amount)->toBe('100.0000')
        ->and($this->item->activePrice()->currency_code)->toBe('USD')
        ->and($this->item->priceIn('USD'))->toBe('100.00')
        ->and($this->item->priceIn('UZS'))->toBe('2366075.18');

    // ...and the row itself was never rewritten.
    expect($price->fresh()->updated_at->equalTo($price->updated_at))->toBeTrue();
});

test('what it was worth in the app currency is snapshotted when it is set', function () {
    $price = $this->item->setPrice('1500000', 'UZS');

    expect($price->base_code)->toBe('USD')
        ->and($price->base_rate)->toBe('11830.3758890000')
        ->and($price->rate_date->toDateString())->toBe(Carbon::today()->toDateString())
        ->and(round((float) $price->base_amount, 2))->toBe(126.79);
});

test('a new price retires the old one instead of overwriting it', function () {
    $first = $this->item->setPrice('100', 'USD');
    $second = $this->item->setPrice('120', 'USD');

    expect($this->item->prices()->count())->toBe(2)
        ->and($first->fresh()->is_active)->toBeFalse()
        ->and($first->fresh()->amount)->toBe('100.0000')
        ->and($second->is_active)->toBeTrue()
        ->and($this->item->activePrice()->id)->toBe($second->id);
});

test('prices of different types stand side by side', function () {
    $this->item->setPrice('100', 'USD');
    $this->item->setPrice('80', 'USD', 'sale');

    expect($this->item->activePrice()->amount)->toBe('100.0000')
        ->and($this->item->activePrice('sale')->amount)->toBe('80.0000')
        ->and($this->item->priceIn('EUR', 'sale'))->toBe('69.70');
});

test('an amount is rounded to the decimals its currency is written with', function () {
    expect($this->item->setPrice('1999.6', 'JPY')->amount)->toBe('2000.0000')
        ->and($this->item->setPrice('10.005', 'USD')->amount)->toBe('10.0100');
});

test('a price in a currency with no rate is still recorded, just without a snapshot', function () {
    currencyRow('XYZ');
    app(CurrencyConverter::class)->forget();

    $price = $this->item->setPrice('50', 'XYZ');

    expect($price->amount)->toBe('50.0000')
        ->and($price->currency_code)->toBe('XYZ')
        ->and($price->base_amount)->toBeNull()
        ->and($price->base_rate)->toBeNull()
        ->and($price->rate_date)->toBeNull()
        ->and($this->item->priceIn('USD'))->toBeNull();
});

test('a currency the app does not offer cannot be priced in', function () {
    currencyRow('OFF')->update(['is_active' => false]);
    app(CurrencyConverter::class)->forget();

    expect(fn () => $this->item->setPrice('10', 'NOPE'))
        ->toThrow(UnknownCurrencyException::class);

    expect(fn () => $this->item->setPrice('10', 'OFF'))
        ->toThrow(UnknownCurrencyException::class);
});

test('a past price still converts at the rate of the day it is read on', function () {
    $this->item->setPrice('100', 'USD');

    rateRow('EUR', '0.95', Carbon::today()->subDay()->toDateString());
    app(CurrencyConverter::class)->forget();

    expect($this->item->priceIn('EUR', on: Carbon::today()->subDay()))->toBe('95.00')
        ->and($this->item->priceIn('EUR'))->toBe('87.13');
});

afterEach(function () {
    Carbon::setTestNow();
    Schema::dropIfExists('priceable_stubs');
});
