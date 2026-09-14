<?php

namespace App\Providers;

use App\Domain\Identity\Models\UserSession;
use App\Policies\UserSessionPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AuthServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::policy(UserSession::class, UserSessionPolicy::class);

        Password::defaults(function () {
            return Password::min(8)
                ->mixedCase()
                ->letters()
                ->numbers();
            // ->symbols()
            // ->uncompromised();
        });
    }
}
