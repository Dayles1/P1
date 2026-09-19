<?php

namespace App\Application\DTO\Currency;

use Illuminate\Support\Carbon;

/**
 * What one run of the daily sync did.
 */
final class ExchangeRateSyncResult
{
    /**
     * @param  list<string>  $createdCurrencyCodes  codes the provider quoted that the catalogue did not have yet
     */
    public function __construct(
        public readonly string $baseCode,
        public readonly Carbon $rateDate,
        public readonly int $ratesSynced,
        public readonly array $createdCurrencyCodes,
        public readonly string $source,
    ) {}
}
