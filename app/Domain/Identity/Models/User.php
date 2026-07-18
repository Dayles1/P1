<?php

namespace App\Domain\Identity\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Domain\AccessControl\Models\Permission;
use App\Domain\AccessControl\Models\Role;
use App\Domain\Attachment\Models\Attachment;
use App\Domain\Audit\Traits\RecordsAudits;
use App\Domain\Ban\Models\Ban;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Identity\Models\UserSession;
use App\Domain\Organization\Models\Department;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, RecordsAudits, SoftDeletes;
    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'created_at' => 'datetime',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class);
    }

    public function directPermissions(): BelongsToMany
    {
        return $this->permissions();
    }

    public function ban(): MorphOne
    {
        return $this->morphOne(Ban::class, 'bannable');
    }

    public function isBanned(): bool
    {
        return $this->ban?->isActive() ?? false;
    }
    public function avatars(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')
            ->where('collection', 'avatar');
    }
    public function avatar(): MorphOne
    {
        return $this->morphOne(Attachment::class, 'attachable')
            ->where('collection', 'avatar')
            ->latestOfMany();
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(UserSession::class);
    }

    protected static function newFactory()
    {
        return UserFactory::new();
    }
    public function conversations(): BelongsToMany
    {
        return $this->belongsToMany(
            Conversation::class,
            'conversation_users'
        )
            ->using(ConversationUser::class)
            ->wherePivotNull('left_at')
            ->withPivot([
                'role',
                'joined_at',
                'left_at',
                'muted_until',
                'last_read_at',
                'last_read_message_id',
                'is_pinned',
                'is_hidden',
                'unread_count',
                'notifications_enabled',
            ])
            ->withTimestamps();
    }
    public function settings()
    {
        return $this->hasOne(UserSetting::class);
    }
    public function currentSession(): HasOne
{
    return $this->hasOne(UserSession::class)
        ->where(
            'personal_access_token_id',
            auth()->user()->currentAccessToken()->id
        );
}




















    public function rolePermissions(): Builder
    {
        return Permission::query()
            ->select('permissions.*')
            ->join('permission_role', 'permissions.id', '=', 'permission_role.permission_id')
            ->join('role_user', 'permission_role.role_id', '=', 'role_user.role_id')
            ->where('role_user.user_id', $this->getKey())
            ->distinct();
    }

    public function allPermissions()
    {
        return Permission::query()
            ->select('permissions.*')
            ->whereIn('permissions.id', function ($query): void {
                $query->select('permission_id')
                    ->from('permission_role')
                    ->whereIn('role_id', function ($subQuery): void {
                        $subQuery->select('role_id')
                            ->from('role_user')
                            ->where('user_id', $this->getKey());
                    });
            })
            ->orWhereIn('permissions.id', $this->permissions()->select('permissions.id'))
            ->distinct();
    }

    public function hasRole(string|Role $role): bool
    {
        $roleId = $role instanceof Role ? $role->getKey() : Role::query()->where('code', $role)->value('id');

        if ($roleId === null) {
            return false;
        }

        return $this->roles()->whereKey($roleId)->exists();
    }

    public function hasDirectPermission(string|Permission $permission): bool
    {
        $permissionId = $permission instanceof Permission
            ? $permission->getKey()
            : Permission::query()->where('code', $permission)->value('id');

        if ($permissionId === null) {
            return false;
        }

        return $this->permissions()->whereKey($permissionId)->exists();
    }

    public function hasPermissionTo(string|Permission $permission): bool
    {
        $permissioncode = $permission instanceof Permission ? $permission->code : $permission;

        return $this->permissions()->where('code', $permissioncode)->exists()
            || $this->roles()
                ->whereHas('permissions', function ($query) use ($permissioncode): void {
                    $query->where('code', $permissioncode);
                })
                ->exists();
    }

    public function hasAnyPermission(array $permissions): bool
    {
        foreach ($permissions as $permission) {
            if ($this->hasPermissionTo($permission)) {
                return true;
            }
        }

        return false;
    }

    public function hasAllPermissions(array $permissions): bool
    {
        foreach ($permissions as $permission) {
            if (!$this->hasPermissionTo($permission)) {
                return false;
            }
        }

        return true;
    }

    public function assignRole(Role|int|string $role): void
    {
        $roleId = $role instanceof Role
            ? $role->getKey()
            : Role::query()->where(is_int($role) ? 'id' : 'code', $role)->value('id');

        if ($roleId !== null) {
            $this->roles()->syncWithoutDetaching([$roleId]);
        }
    }

    public function givePermissionTo(Permission|int|string $permission): void
    {
        $permissionId = $permission instanceof Permission
            ? $permission->getKey()
            : Permission::query()->where(is_int($permission) ? 'id' : 'code', $permission)->value('id');

        if ($permissionId !== null) {
            $this->permissions()->syncWithoutDetaching([$permissionId]);
        }
    }

    public function revokePermissionTo(Permission|int|string $permission): void
    {
        $permissionId = $permission instanceof Permission
            ? $permission->getKey()
            : Permission::query()->where(is_int($permission) ? 'id' : 'code', $permission)->value('id');

        if ($permissionId !== null) {
            $this->permissions()->detach($permissionId);
        }
    }
}
