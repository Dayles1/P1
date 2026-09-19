<?php

namespace App\Domain\Currency\Repository;

use App\Application\DTO\Currency\ExchangeRateSnapshot;
use App\Domain\Currency\Exceptions\ExchangeRateProviderException;

/**
 * Where the day's rates come from. Behind an interface so the sync can
 * be tested without the network, and so swapping providers is a binding
 * change rather than a rewrite.
 */
interface ExchangeRateProviderInterface
{
    /**
     * @throws ExchangeRateProviderException when the provider is unreachable or answers with something unusable
     */
    public function fetch(string $baseCode): ExchangeRateSnapshot;
}
