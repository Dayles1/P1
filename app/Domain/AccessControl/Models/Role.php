<?php

namespace App\Domain\AccessControl\Models;

use App\Domain\Identity\Models\User;
use App\Domain\Localization\Traits\HasTranslations;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Role extends Model
{
    use HasTranslations;
    public const SUPER_ADMIN = 'SUPER_ADMIN';
    public const ADMIN = 'ADMIN';
    public const USER = 'USER';

    protected $fillable = [
        'name',
        'code',
    ];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class);
    }

    public function hasPermission(string|Permission $permission): bool
    {
        $permissionCode = $permission instanceof Permission ? $permission->code : $permission;

        return $this->permissions()->where('code', $permissionCode)->exists();
    }

    public function givePermissionTo(Permission|int|string $permission): void
    {
        $permissionId = $permission instanceof Permission
            ? $permission->getKey()
            : Permission::query()->where($permission instanceof int ? 'id' : 'code', $permission)->value('id');

        if ($permissionId !== null) {
            $this->permissions()->syncWithoutDetaching([$permissionId]);
        }
    }

    public function revokePermissionTo(Permission|int|string $permission): void
    {
        $permissionId = $permission instanceof Permission
            ? $permission->getKey()
            : Permission::query()->where($permission instanceof int ? 'id' : 'code', $permission)->value('id');

        if ($permissionId !== null) {
            $this->permissions()->detach($permissionId);
        }
    }
}