<?php

namespace App\Domain\Currency\Actions;

use App\Application\DTO\Currency\ExchangeRateSyncResult;
use App\Domain\Currency\Models\Currency;
use App\Domain\Currency\Models\ExchangeRate;
use App\Domain\Currency\Repository\ExchangeRateProviderInterface;
use App\Domain\Currency\Services\CurrencyConverter;
use Illuminate\Support\Facades\DB;

/**
 * Pulls the day's rates and files them under the day they belong to.
 *
 * Re-running for a day the app already has overwrites that day's rates
 * rather than adding a second row: the table is one rate per currency
 * per day, and the newest answer for today is the one to keep. Days
 * already past are never touched, so a conversion can still be explained
 * after the fact.
 */
class SyncExchangeRates
{
    public function __construct(
        private readonly ExchangeRateProviderInterface $provider,
        private readonly CurrencyConverter $converter,
    ) {}

    public function handle(): ExchangeRateSyncResult
    {
        $snapshot = $this->provider->fetch($this->converter->baseCode());

        $currencyIds = Currency::query()
            ->pluck('id', 'code')
            ->mapWithKeys(fn (int $id, string $code): array => [strtoupper($code) => $id])
            ->all();

        $created = [];
        $rows = [];
        $rateDate = $snapshot->rateDate->toDateString();

        foreach ($snapshot->rates as $code => $rate) {
            if (! isset($currencyIds[$code])) {
                /*
                 * The provider quoted something the catalogue has never
                 * heard of. Take it — a currency the app cannot convert
                 * is worse than one whose name is still just its code
                 * until CurrencySeeder is next updated.
                 */
                $currencyIds[$code] = Currency::query()->create([
                    'code' => $code,
                    'name' => $code,
                    'decimals' => 2,
                    'is_active' => true,
                ])->id;

                $created[] = $code;
            }

            $rows[] = [
                'currency_id' => $currencyIds[$code],
                'base_code' => $snapshot->baseCode,
                'rate' => $rate,
                'rate_date' => $rateDate,
                'source' => $snapshot->source,
                'fetched_at' => $snapshot->fetchedAt,
            ];
        }

        DB::transaction(function () use ($rows): void {
            foreach (array_chunk($rows, 200) as $chunk) {
                ExchangeRate::query()->upsert(
                    $chunk,
                    ['currency_id', 'base_code', 'rate_date'],
                    ['rate', 'source', 'fetched_at']
                );
            }
        });

        $this->converter->forget();

        return new ExchangeRateSyncResult(
            baseCode: $snapshot->baseCode,
            rateDate: $snapshot->rateDate,
            ratesSynced: count($rows),
            createdCurrencyCodes: $created,
            source: $snapshot->source,
        );
    }
}
