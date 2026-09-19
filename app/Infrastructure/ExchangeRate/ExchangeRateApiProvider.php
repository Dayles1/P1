<?php

namespace App\Infrastructure\ExchangeRate;

use App\Application\DTO\Currency\ExchangeRateSnapshot;
use App\Domain\Currency\Exceptions\ExchangeRateProviderException;
use App\Domain\Currency\Repository\ExchangeRateProviderInterface;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;

/**
 * open.er-api.com — the free, key-less endpoint of ExchangeRate-API. It
 * publishes one set of rates per day (166 currencies against USD) and
 * says in the payload which day they are for, which is what the daily
 * history is keyed on.
 */
class ExchangeRateApiProvider implements ExchangeRateProviderInterface
{
    public const SOURCE = 'open.er-api.com';

    public function fetch(string $baseCode): ExchangeRateSnapshot
    {
        $baseCode = strtoupper($baseCode);

        try {
            $response = Http::acceptJson()
                ->timeout((int) config('currency.provider.timeout'))
                ->retry(
                    (int) config('currency.provider.retries'),
                    (int) config('currency.provider.retry_delay'),
                    throw: false
                )
                ->get(rtrim((string) config('currency.provider.endpoint'), '/')."/{$baseCode}");
        } catch (ConnectionException $e) {
            throw ExchangeRateProviderException::unreachable($e->getMessage());
        }

        if (! $response->successful()) {
            throw ExchangeRateProviderException::unreachable("HTTP {$response->status()}");
        }

        return $this->toSnapshot($response->json() ?? [], $baseCode);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function toSnapshot(array $payload, string $requestedBase): ExchangeRateSnapshot
    {
        if (($payload['result'] ?? null) !== 'success') {
            throw ExchangeRateProviderException::unusableResponse(
                (string) ($payload['error-type'] ?? 'result was not "success"')
            );
        }

        $rates = $payload['rates'] ?? null;

        if (! is_array($rates) || $rates === []) {
            throw ExchangeRateProviderException::unusableResponse('no rates in payload');
        }

        $base = strtoupper((string) ($payload['base_code'] ?? $requestedBase));

        if ($base !== $requestedBase) {
            throw ExchangeRateProviderException::unusableResponse(
                "asked for {$requestedBase}, got {$base}"
            );
        }

        /*
         * The rates belong to the day the provider last published them,
         * not to the day we happened to ask — a sync that runs just after
         * midnight must not file yesterday's numbers under today.
         */
        $rateDate = isset($payload['time_last_update_unix'])
            ? Carbon::createFromTimestampUTC((int) $payload['time_last_update_unix'])
            : Carbon::now('UTC');

        return new ExchangeRateSnapshot(
            baseCode: $base,
            rateDate: $rateDate->startOfDay(),
            fetchedAt: Carbon::now(),
            rates: $this->normalizeRates($rates),
            source: self::SOURCE,
        );
    }

    /**
     * @param  array<array-key, mixed>  $rates
     * @return array<string, string>
     */
    private function normalizeRates(array $rates): array
    {
        $normalized = [];

        foreach ($rates as $code => $rate) {
            if (! is_string($code) || ! is_numeric($rate) || (float) $rate <= 0) {
                continue;
            }

            $normalized[strtoupper($code)] = rtrim(rtrim(number_format((float) $rate, 10, '.', ''), '0'), '.');
        }

        if ($normalized === []) {
            throw ExchangeRateProviderException::unusableResponse('every rate in the payload was unusable');
        }

        return $normalized;
    }
}
