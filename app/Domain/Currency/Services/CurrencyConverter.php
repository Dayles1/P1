<?php

namespace App\Domain\Currency\Services;

use App\Domain\Currency\Models\Currency;
use App\Domain\Currency\Models\ExchangeRate;
use App\Domain\Identity\Models\User;
use App\Domain\Setting\Services\SettingService;
use Illuminate\Support\Carbon;

/**
 * Converts money between currencies through the app currency.
 *
 * Rates are stored as "how many units of X one unit of the app currency
 * buys", so converting A -> B is A -> base -> B. The arithmetic is
 * bcmath on decimal strings rather than floats: rates run from the
 * thousandths (KWD) to the tens of thousands (UZS), and a float round
 * trip through those is exactly where money quietly loses a cent.
 *
 * Resolved as a singleton and memoised per instance rather than cached
 * in a store: the rate table is one indexed query, and a cache here
 * would buy little in exchange for a whole class of "why is it still
 * showing yesterday's rate" bugs.
 */
class CurrencyConverter
{
    /**
     * Rate tables already loaded this request, keyed by "BASE|YYYY-MM-DD".
     *
     * @var array<string, array<string, numeric-string>>
     */
    private array $rateTables = [];

    /**
     * The newest rate_date behind each loaded table, keyed the same way.
     *
     * @var array<string, string|null>
     */
    private array $asOf = [];

    /** @var array<string, Currency>|null */
    private ?array $catalogue = null;

    public function __construct(
        private readonly SettingService $settings
    ) {}

    /**
     * The currency everything is quoted against.
     */
    public function baseCode(): string
    {
        $configured = $this->settings->string('system.base_currency_code');

        return strtoupper($configured !== '' ? $configured : (string) config('currency.base'));
    }

    /**
     * What this user reads prices in — their own choice, or the app
     * currency when they have not made one.
     */
    public function preferredCode(?User $user = null): string
    {
        $code = $user?->settings?->preferredCurrency?->code;

        return $code !== null ? strtoupper($code) : $this->baseCode();
    }

    /**
     * Every currency's rate against the app currency on a given day,
     * falling back per currency to the most recent day before it — a
     * sync that has not run yet (or a currency the provider dropped)
     * must not make prices unconvertible.
     *
     * @return array<string, numeric-string>
     */
    public function rates(?Carbon $on = null): array
    {
        $key = $this->tableKey($on);

        if (! array_key_exists($key, $this->rateTables)) {
            $this->loadRateTable($key);
        }

        return $this->rateTables[$key];
    }

    /**
     * The day the rates in play were actually published, which is not
     * necessarily the day asked for.
     */
    public function ratesAsOf(?Carbon $on = null): ?string
    {
        $this->rates($on);

        return $this->asOf[$this->tableKey($on)];
    }

    /**
     * @return numeric-string|null
     */
    public function rateFor(string $code, ?Carbon $on = null): ?string
    {
        return $this->rates($on)[strtoupper($code)] ?? null;
    }

    /**
     * Converts an amount, rounded to the decimals the target currency is
     * written with. Null when either side has no rate on that day.
     *
     * @return numeric-string|null
     */
    public function convert(
        string|int|float $amount,
        string $from,
        string $to,
        ?Carbon $on = null
    ): ?string {
        $raw = $this->convertRaw($amount, $from, $to, $on);

        return $raw === null
            ? null
            : $this->round($raw, $this->decimalsFor($to));
    }

    /**
     * The same conversion at full working precision — for the stored
     * snapshot on a price, where rounding to the base currency's two
     * decimals would throw away information nothing can recover.
     *
     * @return numeric-string|null
     */
    public function convertRaw(
        string|int|float $amount,
        string $from,
        string $to,
        ?Carbon $on = null
    ): ?string {
        $from = strtoupper($from);
        $to = strtoupper($to);
        $amount = $this->normalize($amount);
        $scale = $this->scale();

        if ($from === $to) {
            return bcadd($amount, '0', $scale);
        }

        $fromRate = $this->rateFor($from, $on);
        $toRate = $this->rateFor($to, $on);

        if ($fromRate === null || $toRate === null || bccomp($fromRate, '0', $scale) === 0) {
            return null;
        }

        return bcmul(bcdiv($amount, $fromRate, $scale), $toRate, $scale);
    }

    /**
     * What one unit is worth each way round, for a rate table.
     *
     * @return array{from: string, to: string, rate: string|null, inverse_rate: string|null, as_of: string|null}
     */
    public function quote(string $from, string $to, ?Carbon $on = null): array
    {
        return [
            'from' => strtoupper($from),
            'to' => strtoupper($to),
            'rate' => $this->convert(1, $from, $to, $on),
            'inverse_rate' => $this->convert(1, $to, $from, $on),
            'as_of' => $this->ratesAsOf($on),
        ];
    }

    /**
     * An amount as a decimal string bcmath will accept — floats never
     * reach it as "1.0E-5", and anything that is not a number at all
     * reads as nothing rather than as a silent zero-ish string.
     *
     * @return numeric-string
     */
    public function normalize(string|int|float $amount): string
    {
        if (is_int($amount)) {
            return (string) $amount;
        }

        if (is_float($amount)) {
            return number_format($amount, $this->scale(), '.', '');
        }

        $trimmed = trim($amount);

        return is_numeric($trimmed) ? $trimmed : '0';
    }

    public function currency(string $code): ?Currency
    {
        return $this->catalogue()[strtoupper($code)] ?? null;
    }

    /**
     * How many fraction digits amounts in this currency are written with
     * (ISO 4217 minor units).
     */
    public function decimalsFor(string $code): int
    {
        $currency = $this->currency($code);

        return $currency instanceof Currency ? $currency->decimals : 2;
    }

    /**
     * Half-up rounding on a decimal string. bcmath truncates, so half a
     * unit of the last kept digit is added (or subtracted) first.
     *
     * @param  numeric-string  $amount
     * @return numeric-string
     */
    public function round(string $amount, int $decimals): string
    {
        $half = bcdiv('5', bcpow('10', (string) ($decimals + 1)), $decimals + 1);

        return str_starts_with($amount, '-')
            ? bcsub($amount, $half, $decimals)
            : bcadd($amount, $half, $decimals);
    }

    /**
     * Drops what was memoised — for a long-running process (queue worker,
     * Octane) and for anything that writes rates after having read them.
     */
    public function forget(): void
    {
        $this->rateTables = [];
        $this->asOf = [];
        $this->catalogue = null;
    }

    private function tableKey(?Carbon $on): string
    {
        return $this->baseCode().'|'.($on ?? Carbon::today())->toDateString();
    }

    private function loadRateTable(string $key): void
    {
        [$base, $date] = explode('|', $key, 2);

        /*
         * Dropped to the query builder for the join: the rows are a
         * currency code next to a rate, not ExchangeRate models, and
         * pretending otherwise only invites `$rate->code`.
         */
        $rows = ExchangeRate::query()
            ->latestOnOrBefore($base, $date)
            ->join('currencies', 'currencies.id', '=', 'exchange_rates.currency_id')
            ->toBase()
            ->get([
                'currencies.code',
                'exchange_rates.rate',
                'exchange_rates.rate_date',
            ]);

        $table = [];
        $asOf = null;

        foreach ($rows as $row) {
            $rate = (string) $row->rate;

            if (! is_numeric($rate)) {
                continue;
            }

            $table[strtoupper((string) $row->code)] = $rate;
            $rowDate = Carbon::parse((string) $row->rate_date)->toDateString();

            if ($asOf === null || $rowDate > $asOf) {
                $asOf = $rowDate;
            }
        }

        /*
         * The app currency is worth one of itself whether or not the
         * provider bothered to quote it.
         */
        $table[$base] = '1';

        $this->rateTables[$key] = $table;
        $this->asOf[$key] = $asOf;
    }

    /**
     * @return array<string, Currency>
     */
    private function catalogue(): array
    {
        return $this->catalogue ??= Currency::query()
            ->get()
            ->keyBy(fn (Currency $currency): string => strtoupper($currency->code))
            ->all();
    }

    private function scale(): int
    {
        return (int) config('currency.scale', 12);
    }
}
