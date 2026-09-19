<?php

namespace App\Domain\Price\Models;

use App\Domain\Currency\Models\Currency;
use App\Domain\Currency\Services\CurrencyConverter;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;

/**
 * What someone asked for something, in the currency they asked in.
 *
 * `amount` + `currency_code` are the price and are never recalculated.
 * Every other currency is worked out from them on the way out, at
 * whatever the rate is when someone looks — so the market moving changes
 * what a buyer in another currency pays, never what the seller asked.
 *
 * The `base_*` columns are what it was worth in the app currency on the
 * day it was set. They exist so prices in different currencies can be
 * compared and totalled against one stable number, and so the rate a
 * conversion used can still be shown afterwards.
 *
 * Prices are polymorphic, so a model opts in with the relation and as
 * much sugar over it as it wants:
 *
 *     public function prices(): MorphMany
 *     {
 *         return $this->morphMany(Price::class, 'priceable')->latest('id');
 *     }
 *
 *     public function setPrice(string $amount, string $currencyCode): Price
 *     {
 *         return app(SetPrice::class)->handle($this, $amount, $currencyCode);
 *     }
 */
class Price extends Model
{
    public const TYPE_REGULAR = 'regular';

    protected $fillable = [
        'priceable_id',
        'priceable_type',
        'currency_code',
        'amount',
        'base_code',
        'base_amount',
        'base_rate',
        'rate_date',
        'type',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:4',
            'base_amount' => 'decimal:8',
            'base_rate' => 'decimal:10',
            'is_active' => 'boolean',
        ];
    }

    /**
     * Stored as a plain date.
     *
     * Which day's rate table the snapshot beside it came from. The
     * `date` cast hands the driver a "Y-m-d H:i:s" string, which MySQL
     * truncates to the DATE column but SQLite keeps verbatim, so the
     * same row reads back differently per driver.
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

    /**
     * The price that stands right now for something, in the currency it
     * was set in.
     */
    public static function activeFor(Model $priceable, string $type = self::TYPE_REGULAR): ?self
    {
        return static::query()
            ->whereMorphedTo('priceable', $priceable)
            ->active()
            ->ofType($type)
            ->latest('id')
            ->first();
    }

    /** @return MorphTo<Model, $this> */
    public function priceable(): MorphTo
    {
        return $this->morphTo();
    }

    /** @return BelongsTo<Currency, $this> */
    public function currency(): BelongsTo
    {
        return $this->belongsTo(Currency::class, 'currency_code', 'code');
    }

    /**
     * @param  Builder<$this>  $query
     * @return Builder<$this>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * @param  Builder<$this>  $query
     * @return Builder<$this>
     */
    public function scopeOfType(Builder $query, string $type): Builder
    {
        return $query->where('type', $type);
    }

    /**
     * This price in another currency, at today's rate unless a day is
     * named. Converted from what was actually asked, not from the stored
     * base snapshot, so the result is rounded once instead of twice.
     */
    public function convertedTo(string $code, ?Carbon $on = null): ?string
    {
        return app(CurrencyConverter::class)->convert(
            (string) $this->amount,
            $this->currency_code,
            $code,
            $on
        );
    }
}
