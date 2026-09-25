<?php

namespace App\Domain\Payment\Services;

use App\Domain\Payment\Enums\PaymentProvider;
use App\Domain\Payment\Exceptions\PaymentException;
use App\Domain\Payment\Repository\CardTokenGatewayInterface;
use App\Domain\Payment\Repository\PaymentGatewayInterface;

/**
 * Finds the gateway for a provider. The gateways themselves are
 * registered in InfrastructureServiceProvider.
 */
class PaymentGatewayRegistry
{
    /** @var array<string, PaymentGatewayInterface> */
    private array $gateways = [];

    /**
     * @param  iterable<PaymentGatewayInterface>  $gateways
     */
    public function __construct(iterable $gateways)
    {
        foreach ($gateways as $gateway) {
            $this->gateways[$gateway->provider()->value] = $gateway;
        }
    }

    /**
     * @throws PaymentException
     */
    public function gateway(PaymentProvider $provider): PaymentGatewayInterface
    {
        return $this->gateways[$provider->value]
            ?? throw PaymentException::unsupportedProvider($provider->value);
    }

    /**
     * @throws PaymentException when the provider cannot tokenise cards
     */
    public function cardGateway(PaymentProvider $provider): CardTokenGatewayInterface
    {
        $gateway = $this->gateway($provider);

        if (! $gateway instanceof CardTokenGatewayInterface) {
            throw PaymentException::unsupportedProvider($provider->value);
        }

        return $gateway;
    }

    /**
     * @return list<PaymentProvider>
     */
    public function cardProviders(): array
    {
        return array_values(array_map(
            fn (PaymentGatewayInterface $gateway): PaymentProvider => $gateway->provider(),
            array_filter($this->gateways, fn (PaymentGatewayInterface $gateway): bool => $gateway instanceof CardTokenGatewayInterface)
        ));
    }
}
