<?php

namespace App\Domain\Currency\Models;

use Database\Factories\CurrencyFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

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

    protected static function newFactory(): CurrencyFactory
    {
        return CurrencyFactory::new();
    }
}
