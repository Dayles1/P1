<?php

namespace App\Http\Controllers\Api\Currency;

use App\Domain\Currency\Actions\ListExchangeRates;
use App\Domain\Currency\Services\CurrencyConverter;
use App\Http\Controllers\Controller;
use App\Http\Resources\Currency\ExchangeRateResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ExchangeRateController extends Controller
{
    public function __construct(
        private readonly ListExchangeRates $listExchangeRates,
        private readonly CurrencyConverter $converter,
    ) {}

    /**
     * The rate table against the app currency — today's, or any past
     * day's via `?date=YYYY-MM-DD`.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $on = $request->filled('date')
            ? Carbon::parse($request->string('date')->value())
            : null;

        return $this->success(
            data: ExchangeRateResource::collection($this->listExchangeRates->handle($on)),
            meta: [
                'base_code' => $this->converter->baseCode(),
                'as_of' => $this->converter->ratesAsOf($on),
            ]
        );
    }
}
