<?php

namespace App\Domain\Chat\Providers;

use App\Domain\Chat\Repositories\ConversationRepositoryInterface;
use App\Infrastructure\Persistence\Eloquent\Chat\ConversationRepository;
use Illuminate\Support\ServiceProvider;

class ConversationServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            ConversationRepositoryInterface::class,
            ConversationRepository::class
        );
    }

    public function boot(): void
    {
        //
    }
}