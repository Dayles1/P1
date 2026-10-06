<?php

namespace App\Domain\Chat\Providers;

use App\Domain\Chat\Repositories\ConversationRepositoryInterface;
use App\Infrastructure\Persistence\Eloquent\Chat\ConversationRepository;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
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

    /**
     * Per-user limits on the chat endpoints someone could hammer: each send
     * fans out to every member (broadcasts, notifications), typing and
     * reactions broadcast too, and search scans message bodies.
     */
    public function boot(): void
    {
        foreach (['send', 'typing', 'reactions', 'search'] as $name) {
            RateLimiter::for("chat-{$name}", fn (Request $request): Limit => Limit::perMinute(
                max(1, (int) config("chat.rate_limits.{$name}", 60)),
            )->by($name.'|'.($request->user()->id ?? $request->ip())));
        }
    }
}
