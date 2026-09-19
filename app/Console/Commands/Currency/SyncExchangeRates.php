<?php

namespace App\Console\Commands\Currency;

use App\Domain\Currency\Actions\SyncExchangeRates as SyncExchangeRatesAction;
use App\Domain\Currency\Exceptions\ExchangeRateProviderException;
use Illuminate\Console\Command;

class SyncExchangeRates extends Command
{
    protected $signature = 'currency:sync';

    protected $description = "Fetch the day's exchange rates against the app currency and store them";

    public function handle(SyncExchangeRatesAction $sync): int
    {
        try {
            $result = $sync->handle();
        } catch (ExchangeRateProviderException $e) {
            /*
             * Yesterday's rates are still in the table and still get
             * used, so a failed sync is a warning worth a non-zero exit
             * (the scheduler reports it) rather than an outage.
             */
            $this->components->error($e->getMessage());

            return self::FAILURE;
        }

        $this->components->info(sprintf(
            '%d rates against %s for %s (via %s).',
            $result->ratesSynced,
            $result->baseCode,
            $result->rateDate->toDateString(),
            $result->source,
        ));

        if ($result->createdCurrencyCodes !== []) {
            $this->components->warn(sprintf(
                'Added %d currency the catalogue did not have: %s. Give them a name in CurrencySeeder.',
                count($result->createdCurrencyCodes),
                implode(', ', $result->createdCurrencyCodes),
            ));
        }

        return self::SUCCESS;
    }
}
