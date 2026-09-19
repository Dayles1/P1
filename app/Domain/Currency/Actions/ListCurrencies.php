<?php

namespace App\Domain\Currency\Actions;

use App\Domain\Currency\Models\Currency;
use Illuminate\Database\Eloquent\Collection;

class ListCurrencies
{
    /**
     * @return Collection<int, Currency>
     */
    public function handle(): Collection
    {
        return Currency::query()
            ->active()
            ->orderBy('code')
            ->get();
    }
}
