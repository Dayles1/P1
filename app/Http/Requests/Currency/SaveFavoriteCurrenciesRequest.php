<?php

namespace App\Http\Requests\Currency;

use App\Domain\Currency\Actions\GetFavoriteCurrencies;
use Illuminate\Foundation\Http\FormRequest;

class SaveFavoriteCurrenciesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $max = app(GetFavoriteCurrencies::class)->maxFavorites();

        return [
            'favorite_currency_ids' => ['present', 'array', "max:{$max}"],
            'favorite_currency_ids.*' => ['integer', 'distinct', 'exists:currencies,id'],
        ];
    }
}
