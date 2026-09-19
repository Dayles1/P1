<?php

namespace App\Providers;

use App\Domain\Currency\Repository\ExchangeRateProviderInterface;
use App\Domain\Currency\Services\CurrencyConverter;
use App\Domain\Identity\Repository\RequestLogRepositoryInterface;
use App\Domain\Identity\Repository\UserSessionRepositoryInterface;
use App\Domain\Profile\Repository\ProfileRepositoryInterface;
use App\Infrastructure\ExchangeRate\ExchangeRateApiProvider;
use App\Infrastructure\Persistence\Eloquent\Profile\ProfileRepository;
use App\Infrastructure\Persistence\Eloquent\RequestLog\RequestLogRepository;
use App\Infrastructure\Persistence\Eloquent\Session\UserSessionRepository;
use Illuminate\Support\ServiceProvider;

class InfrastructureServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            ProfileRepositoryInterface::class,
            ProfileRepository::class
        );
        $this->app->bind(
            UserSessionRepositoryInterface::class,
            UserSessionRepository::class
        );
        $this->app->bind(
            RequestLogRepositoryInterface::class,
            RequestLogRepository::class
        );
        $this->app->bind(
            ExchangeRateProviderInterface::class,
            ExchangeRateApiProvider::class
        );

        /*
         * A singleton so the rate table is read once per request rather
         * than once per conversion — a list of prices converts dozens of
         * times off the same table.
         */
        $this->app->singleton(CurrencyConverter::class);
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        //
    }
}
