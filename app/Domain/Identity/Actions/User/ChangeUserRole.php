<?php

namespace App\Domain\Identity\Actions\User;

use App\Domain\AccessControl\Models\Role;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Services\SuperAdminGuard;
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

        $target->roles()->sync([$role->id]);

        return $target->fresh(['roles']);
    }
}
