<?php

namespace App\Domain\Identity\Services;

use App\Domain\AccessControl\Models\Role;
use App\Domain\Identity\Models\User;
use App\Domain\Setting\Services\SettingService;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * Backs the `auth.protect_superadmin` setting with real behavior: when
 * enabled, only another SUPER_ADMIN may change a SUPER_ADMIN's role or ban
 * them, and only a SUPER_ADMIN may grant the SUPER_ADMIN role to anyone.
 * Previously this setting existed and was seeded/locked but nothing in the
 * app ever read it.
 */
class SuperAdminGuard
{
    public function __construct(
        private readonly SettingService $settings,
    ) {}

    public function assertCanModify(User $actor, User $target): void
    {
        if (! $this->settings->boolean('auth.protect_superadmin', true)) {
            return;
        }

        if ($target->hasRole(Role::SUPER_ADMIN) && ! $actor->hasRole(Role::SUPER_ADMIN)) {
            throw new AccessDeniedHttpException(__('messages.admin.superadmin_protected'));
        }
    }

    public function assertCanGrantRole(User $actor, string $roleCode): void
    {
        if (! $this->settings->boolean('auth.protect_superadmin', true)) {
            return;
        }

        if ($roleCode === Role::SUPER_ADMIN && ! $actor->hasRole(Role::SUPER_ADMIN)) {
            throw new AccessDeniedHttpException(__('messages.admin.superadmin_protected'));
        }
    }
}
