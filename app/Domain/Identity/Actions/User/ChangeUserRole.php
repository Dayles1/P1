<?php

namespace App\Domain\Identity\Actions\User;

use App\Domain\AccessControl\Models\Role;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Services\SuperAdminGuard;
use App\Domain\Notification\Notifications\RoleChangedNotification;
use App\Infrastructure\Broadcasting\LiveUpdates;
use Illuminate\Validation\ValidationException;

class ChangeUserRole
{
    public function __construct(
        private readonly SuperAdminGuard $superAdminGuard,
    ) {}

    public function handle(User $actor, User $target, string $roleCode): User
    {
        $this->superAdminGuard->assertCanModify($actor, $target);
        $this->superAdminGuard->assertCanGrantRole($actor, $roleCode);

        $role = Role::query()->where('code', $roleCode)->first();

        if (! $role) {
            throw ValidationException::withMessages([
                'role' => __('messages.admin.role_not_found'),
            ]);
        }

        $previousRoles = $target->roles()->get(['roles.id', 'roles.name']);

        $target->roles()->sync([$role->id]);

        $changed = $previousRoles->count() !== 1 || (int) $previousRoles->first()->id !== (int) $role->id;

        if ($changed && (int) $actor->id !== (int) $target->id) {
            LiveUpdates::safely(fn () => $target->notify(new RoleChangedNotification(
                actor: $actor,
                roleCode: (string) $role->code,
                roleName: (string) $role->name,
                previousRoleName: $previousRoles->first()?->name,
            )));
        }

        return $target->fresh(['roles']);
    }
}
