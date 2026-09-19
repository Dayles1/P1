<?php

namespace Tests\Fixtures;

use App\Domain\Price\Actions\SetPrice;
use App\Domain\Price\Models\Price;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Support\Carbon;

/**
 * Something to put a price on.
 *
 * Prices are polymorphic on purpose — nothing in the app sells anything
 * yet, and whatever eventually does opts in exactly like this. This
 * stands in for that, so the pricing rules are tested on their own
 * rather than through some unrelated model.
 */
class PriceableStub extends Model
{
    protected $table = 'priceable_stubs';

    protected $guarded = [];

    /** @return MorphMany<Price, $this> */
    public function prices(): MorphMany
    {
        return $this->morphMany(Price::class, 'priceable')->latest('id');
    }

    public function activePrice(string $type = Price::TYPE_REGULAR): ?Price
    {
        return Price::activeFor($this, $type);
    }

    public function setPrice(
        string|int|float $amount,
        ?string $currencyCode = null,
        string $type = Price::TYPE_REGULAR
    ): Price {
        return app(SetPrice::class)->handle($this, $amount, $currencyCode, $type);
    }

    public function priceIn(
        string $currencyCode,
        string $type = Price::TYPE_REGULAR,
        ?Carbon $on = null
    ): ?string {
        return $this->activePrice($type)?->convertedTo($currencyCode, $on);
    }
}
