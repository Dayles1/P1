<?php

namespace App\Http\Controllers\Api\Payment;

use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Services\PaymentGatewayRegistry;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Server-to-server notifications from payment providers. Unauthenticated
 * by design: each gateway checks its own provider's signature or
 * credentials, and answers in that provider's format.
 */
class PaymentCallbackController extends Controller
{
    public function __construct(
        private readonly PaymentGatewayRegistry $gateways,
    ) {}

    public function __invoke(Request $request, string $provider): Response
    {
        $provider = PaymentProvider::tryFrom($provider);

        abort_if($provider === null || ! $provider->isExternal(), 404);

        return $this->gateways->gateway($provider)->handleCallback($request);
    }
}
