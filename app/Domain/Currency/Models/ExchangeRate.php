<?php

namespace App\Domain\Currency\Models;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Database\Factories\ExchangeRateFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Carbon;

/**
 * One currency's rate against the app currency for one day.
 *
 * Rows are never updated once the day has passed — a sync writes today's
 * row, so the table is a history the app can look a conversion up in
 * after the fact.
 */
class ExchangeRate extends Model
{
    /** @use HasFactory<ExchangeRateFactory> */
    use HasFactory;

    protected $fillable = [
        'currency_id',
        'base_code',
        'rate',
        'rate_date',
        'source',
        'fetched_at',
    ];

    protected function casts(): array
    {
        return [
            'rate' => 'decimal:10',
            'fetched_at' => 'datetime',
        ];
    }

    /**
     * Stored as a plain date.
     *
     * The `date` cast hands the driver a "Y-m-d H:i:s" string. MySQL
     * truncates that to the DATE column, SQLite keeps it verbatim — and
     * then every `rate_date <= '2026-09-19'` comparison quietly stops
     * matching, which is the whole of the daily lookup.
     *
     * @return Attribute<CarbonImmutable|null, string|null>
     */
    protected function rateDate(): Attribute
    {
        return Attribute::make(
            get: static fn (?string $value): ?CarbonImmutable => $value === null
                ? null
                : CarbonImmutable::parse($value),
            set: static fn (CarbonInterface|string|null $value): ?string => $value === null
                ? null
                : Carbon::parse($value)->toDateString(),
        );
    }

    /** @return BelongsTo<Currency, $this> */
    public function currency(): BelongsTo
    {
        return $this->belongsTo(Currency::class);
    }

    /**
     * The newest row per currency that is not dated after `$date`.
     *
     * A day with no sync (a holiday, an outage, a currency the provider
     * dropped) falls back to the last day that does have one, per
     * currency, rather than leaving a hole conversions would read as
     * "no rate".
     *
     * Joins, so select `exchange_rates.*` when you want models back.
     *
     * @param  Builder<$this>  $query
     * @return Builder<$this>
     */
    public function scopeLatestOnOrBefore(Builder $query, string $baseCode, string $date): Builder
    {
        $baseCode = strtoupper($baseCode);

        $latest = static::query()
            ->selectRaw('currency_id, MAX(rate_date) as rate_date')
            ->where('base_code', $baseCode)
            ->where('rate_date', '<=', $date)
            ->groupBy('currency_id');

        return $query
            ->where('exchange_rates.base_code', $baseCode)
            ->joinSub($latest, 'latest', function (JoinClause $join): void {
                $join->on('exchange_rates.currency_id', '=', 'latest.currency_id')
                    ->on('exchange_rates.rate_date', '=', 'latest.rate_date');
            });
    }

    protected static function newFactory(): ExchangeRateFactory
    {
        return ExchangeRateFactory::new();
    }
}
