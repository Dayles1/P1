<?php

namespace App\Domain\Currency\Actions;

use App\Domain\Currency\Models\ExchangeRate;
use App\Domain\Currency\Services\CurrencyConverter;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Carbon;

/**
 * The rate table as it stood on a given day — today by default, and any
 * past day on request, which is the point of keeping a row per day.
 */
class ListExchangeRates
{
    public function __construct(
        private readonly CurrencyConverter $converter
    ) {}

    /**
     * @return Collection<int, ExchangeRate>
     */
    public function handle(?Carbon $on = null): Collection
    {
        return ExchangeRate::query()
            ->latestOnOrBefore(
                $this->converter->baseCode(),
                ($on ?? Carbon::today())->toDateString()
            )
            ->join('currencies', 'currencies.id', '=', 'exchange_rates.currency_id')
            ->where('currencies.is_active', true)
            ->with('currency')
            ->orderBy('currencies.code')
            ->select('exchange_rates.*')
            ->get();
    }
}
