<?php

namespace App\Http\Controllers\Api\Currency;

use App\Domain\Currency\Actions\GetFavoriteCurrencies;
use App\Domain\Currency\Actions\SaveFavoriteCurrencies;
use App\Http\Controllers\Controller;
use App\Http\Requests\Currency\SaveFavoriteCurrenciesRequest;
use App\Http\Resources\Currency\FavoriteCurrencyResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The shortlist of currencies a user watches their prices against.
 */
class FavoriteCurrencyController extends Controller
{
    public function __construct(
        private readonly GetFavoriteCurrencies $getFavorites,
        private readonly SaveFavoriteCurrencies $saveFavorites,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return $this->success(
            data: FavoriteCurrencyResource::collection(
                $this->getFavorites->handle($request->user())
            ),
            meta: ['max' => $this->getFavorites->maxFavorites()]
        );
    }

    public function update(SaveFavoriteCurrenciesRequest $request): JsonResponse
    {
        $user = $request->user();

        $this->saveFavorites->handle(
            user: $user,
            currencyIds: $request->validated('favorite_currency_ids')
        );

        return $this->success(
            data: FavoriteCurrencyResource::collection(
                $this->getFavorites->handle($user->fresh())
            ),
            message: __('messages.settings.updated')
        );
    }
}
