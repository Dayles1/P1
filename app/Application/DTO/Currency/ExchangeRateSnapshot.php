<?php

namespace App\Application\DTO\Currency;

use Illuminate\Support\Carbon;

/**
 * One provider response: every rate it quoted against `baseCode`, and
 * the day those rates belong to.
 */
final class ExchangeRateSnapshot
{
    /**
     * @param  array<string, string>  $rates  currency code => units per 1 base, as a decimal string
     */
    public function __construct(
        public readonly string $baseCode,
        public readonly Carbon $rateDate,
        public readonly Carbon $fetchedAt,
        public readonly array $rates,
        public readonly string $source,
    ) {}
}
