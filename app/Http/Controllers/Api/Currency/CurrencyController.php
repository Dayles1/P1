<?php

namespace App\Http\Controllers\Api\Currency;

use App\Domain\Currency\Actions\ListCurrencies;
use App\Domain\Currency\Services\CurrencyConverter;
use App\Http\Controllers\Controller;
use App\Http\Requests\Currency\ConvertCurrencyRequest;
use App\Http\Resources\Currency\CurrencyResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class CurrencyController extends Controller
{
    public function __construct(
        private readonly ListCurrencies $listCurrencies,
        private readonly CurrencyConverter $converter,
    ) {}

    /**
     * The currencies on offer, plus which one is the app's and which one
     * the caller reads prices in.
     */
    public function index(Request $request): JsonResponse
    {
        /*
         * This route is open (reference data, same as timezones), so
         * nothing has resolved a guard yet and `$request->user()` would
         * ask the session guard. Name the token guard to answer
         * `preferred_code` for a caller who did send a bearer token,
         * without shutting the list out of everyone who did not.
         */
        $user = $request->user('sanctum');

        return $this->success(
            data: CurrencyResource::collection($this->listCurrencies->handle()),
            meta: [
                'base_code' => $this->converter->baseCode(),
                'preferred_code' => $this->converter->preferredCode($user),
                'rates_as_of' => $this->converter->ratesAsOf(),
            ]
        );
    }

    /**
     * Converts an amount between two currencies, at today's rate or at
     * a past day's.
     */
    public function convert(ConvertCurrencyRequest $request): JsonResponse
    {
        $on = $request->filled('date')
            ? Carbon::parse($request->string('date')->value())
            : null;

        $from = $request->string('from')->value();
        $to = $request->string('to')->value();

        $converted = $this->converter->convert(
            $request->string('amount')->value(),
            $from,
            $to,
            $on
        );

        if ($converted === null) {
            return $this->error(
                message: __('messages.currency.no_rate', ['from' => $from, 'to' => $to]),
                status: 422
            );
        }

        return $this->success(data: [
            'amount' => $this->converter->round(
                $this->converter->normalize($request->string('amount')->value()),
                $this->converter->decimalsFor($from)
            ),
            'from' => $from,
            'to' => $to,
            'converted' => $converted,
            'rate' => $this->converter->convert(1, $from, $to, $on),
            'as_of' => $this->converter->ratesAsOf($on),
        ]);
    }
}
