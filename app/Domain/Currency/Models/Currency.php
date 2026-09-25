<?php

namespace App\Domain\Currency\Models;

use Database\Factories\CurrencyFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use InvalidArgumentException;

/**
 * An ISO 4217 currency the app knows about. The catalogue is seeded
 * offline (CurrencySeeder) and does not depend on the rate provider
 * being reachable — a currency exists whether or not today's rate for
 * it has been fetched yet.
 */
class Currency extends Model
{
    /** @use HasFactory<CurrencyFactory> */
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'symbol',
        'decimals',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'decimals' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /** @return HasMany<ExchangeRate, $this> */
    public function exchangeRates(): HasMany
    {
        return $this->hasMany(ExchangeRate::class);
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
    public function scopeByCode(Builder $query, string $code): Builder
    {
        return $query->where('code', strtoupper($code));
    }

    /**
     * An amount as written ("1500.50") in this currency's minor units
     * (150050 tiyin), the form payments and wallets store money in.
     * Anything past this currency's decimals is cut off, not rounded up.
     */
    public function toMinorUnits(string|int|float $amount): int
    {
        /*
         * A float is written out in full first: casting it straight to a
         * string can give "1.0E-5", which bcmath does not read.
         */
        $amount = is_float($amount)
            ? number_format($amount, $this->decimals, '.', '')
            : (string) $amount;

        if (! is_numeric($amount)) {
            throw new InvalidArgumentException("[{$amount}] is not an amount.");
        }

        return (int) bcmul($amount, bcpow('10', (string) $this->decimals), 0);
    }

    /**
     * Minor units back to an amount as written, with this currency's
     * decimals: 150050 -> "1500.50".
     *
     * @return numeric-string
     */
    public function fromMinorUnits(int $amount): string
    {
        return bcdiv((string) $amount, bcpow('10', (string) $this->decimals), $this->decimals);
    }

    protected static function newFactory(): CurrencyFactory
    {
        return CurrencyFactory::new();
    }
}
