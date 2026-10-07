<?php

use App\Domain\Chat\Providers\ConversationServiceProvider;
use App\Games\GamesServiceProvider;
use App\Providers\AppServiceProvider;
use App\Providers\AuthServiceProvider;
use App\Providers\InfrastructureServiceProvider;

return [
    AppServiceProvider::class,
    AuthServiceProvider::class,
    InfrastructureServiceProvider::class,
    ConversationServiceProvider::class,
    GamesServiceProvider::class,
];
