<?php

use App\Domain\Chat\Providers\ConversationServiceProvider;
use App\Games\City3\City3ServiceProvider;
use App\Games\GamesServiceProvider;
use App\Games\GuWorld\GuWorldServiceProvider;
use App\Games\Sandbox\SandboxServiceProvider;
use App\Providers\AppServiceProvider;
use App\Providers\AuthServiceProvider;
use App\Providers\InfrastructureServiceProvider;

return [
    AppServiceProvider::class,
    AuthServiceProvider::class,
    InfrastructureServiceProvider::class,
    ConversationServiceProvider::class,
    // Before GamesServiceProvider: its /games catch-all would shadow /games/sandbox, /games/gu-world and /games/city3.
    SandboxServiceProvider::class,
    GuWorldServiceProvider::class,
    City3ServiceProvider::class,
    GamesServiceProvider::class,
];
