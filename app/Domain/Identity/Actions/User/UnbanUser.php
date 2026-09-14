<?php

namespace App\Domain\Identity\Actions\User;

use App\Domain\Ban\Actions\UnbanEntity;
use App\Domain\Ban\Models\Ban;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Services\SuperAdminGuard;

class UnbanUser
{
    public function __construct(
        private readonly UnbanEntity $unbanEntity,
        private readonly SuperAdminGuard $superAdminGuard,
    ) {}

    public function handle(User $actor, User $target): ?Ban
    {
        $this->superAdminGuard->assertCanModify($actor, $target);

        return $this->unbanEntity->handle($target, $actor->id);
    }
}
