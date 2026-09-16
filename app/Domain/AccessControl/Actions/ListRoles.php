<?php

namespace App\Domain\AccessControl\Actions;

use App\Domain\AccessControl\Models\Role;
use Illuminate\Database\Eloquent\Collection;

class ListRoles
{
    /**
     * @return Collection<int, Role>
     */
    public function handle(): Collection
    {
        return Role::query()->orderBy('id')->get();
    }
}
