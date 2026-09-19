<?php

namespace Database\Seeders;

use App\Domain\Currency\Actions\SyncExchangeRates;
use App\Domain\Currency\Exceptions\ExchangeRateProviderException;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Console\Output\ConsoleOutput;

/**
 * Today's rates, by running the same sync the scheduler runs — there is
 * no second, seed-only copy of the fetch to drift out of step.
 *
 * A provider that cannot be reached is a warning, not a failed seed: the
 * app runs without rates (prices still record, they just do not convert)
 * and the next `currency:sync` fills them in. Nothing here invents a
 * rate to seed with.
 */
class ExchangeRateSeeder extends Seeder
{
    public function run(SyncExchangeRates $sync): void
    {
        try {
            $result = $sync->handle();
        } catch (ExchangeRateProviderException $e) {
            $this->report("Exchange rates not seeded: {$e->getMessage()}");
            $this->report('Run `php artisan currency:sync` once the provider is reachable.');

            return;
        }

        $this->report(sprintf(
            'Seeded %d exchange rates against %s for %s.',
            $result->ratesSynced,
            $result->baseCode,
            $result->rateDate->toDateString(),
        ));
    }

    /**
     * Seeder::$command is only set when a seeder is run by the console
     * runner, and `$this->seed()` in a test leaves it uninitialised —
     * so this writes to the console when there is one and to the log
     * otherwise, rather than reaching for a property that may not be
     * there.
     */
    private function report(string $message): void
    {
        if (! app()->runningInConsole()) {
            Log::info($message);

            return;
        }

        (new ConsoleOutput)->writeln("  <comment>{$message}</comment>");
    }
}
