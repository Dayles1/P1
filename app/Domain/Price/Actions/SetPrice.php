<?php

namespace App\Domain\Price\Actions;

use App\Domain\Currency\Exceptions\UnknownCurrencyException;
use App\Domain\Currency\Services\CurrencyConverter;
use App\Domain\Price\Models\Price;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Records a price in the currency its owner chose.
 *
 * The amount is stored as typed (rounded only to the number of decimals
 * that currency is written with) and is never touched again. A previous
 * price of the same type is retired rather than overwritten, so the
 * history keeps both the old amount and the rate it was set at.
 */
class SetPrice
{
    public function __construct(
        private readonly CurrencyConverter $converter
    ) {}

    /**
     * @throws UnknownCurrencyException
     */
    public function handle(
        Model $priceable,
        string|int|float $amount,
        ?string $currencyCode = null,
        string $type = Price::TYPE_REGULAR,
        ?Carbon $on = null
    ): Price {
        $code = strtoupper($currencyCode ?? $this->converter->baseCode());
        $currency = $this->converter->currency($code);

        if ($currency === null || ! $currency->is_active) {
            throw UnknownCurrencyException::code($code);
        }

        $baseCode = $this->converter->baseCode();
        $amount = $this->converter->round(
            $this->converter->normalize($amount),
            $currency->decimals
        );

        /*
         * The snapshot is best effort. A missing rate is a reason to
         * leave the base columns empty, never a reason to refuse to
         * record what the owner asked for.
         */
        $baseRate = $this->converter->rateFor($code, $on);
        $baseAmount = $this->converter->convertRaw($amount, $code, $baseCode, $on);

        $prices = $priceable->morphMany(Price::class, 'priceable');

        return DB::transaction(function () use (
            $prices,
            $amount,
            $code,
            $type,
            $baseCode,
            $baseRate,
            $baseAmount,
            $on
        ): Price {
            (clone $prices)
                ->active()
                ->ofType($type)
                ->update(['is_active' => false]);

            return $prices->create([
                'currency_code' => $code,
                'amount' => $amount,
                'base_code' => $baseCode,
                'base_amount' => $baseAmount,
                'base_rate' => $baseAmount === null ? null : $baseRate,
                'rate_date' => $baseAmount === null ? null : $this->converter->ratesAsOf($on),
                'type' => $type,
                'is_active' => true,
            ]);
        });
    }
}
