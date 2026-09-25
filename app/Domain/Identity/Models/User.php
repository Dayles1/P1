<?php

namespace App\Domain\Identity\Models;

use App\Domain\AccessControl\Models\Permission;
use App\Domain\AccessControl\Models\Role;
use App\Domain\Attachment\Models\Attachment;
use App\Domain\Audit\Traits\RecordsAudits;
use App\Domain\Ban\Models\Ban;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Identity\Notifications\VerifyEmailWithCode;
use App\Domain\Identity\Services\VerificationCodeService;
use App\Domain\Organization\Models\Department;
use App\Domain\Payment\Models\Card;
use App\Domain\Payment\Models\Payment;
use App\Domain\Wallet\Models\Wallet;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
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

class User extends Authenticatable implements MustVerifyEmail
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
            'last_seen_at' => 'datetime',
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

    /** @return MorphMany<Attachment, $this> */
    public function avatars(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')
            ->where('collection', 'avatar');
    }

    /** @return MorphOne<Attachment, $this> */
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

    /** @return HasMany<Wallet, $this> */
    public function wallets(): HasMany
    {
        return $this->hasMany(Wallet::class);
    }

    /** @return HasMany<Payment, $this> */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    /** @return HasMany<Card, $this> */
    public function cards(): HasMany
    {
        return $this->hasMany(Card::class);
    }

    /** @return HasOne<UserSetting, $this> */
    public function settings(): HasOne
    {
        return $this->hasOne(UserSetting::class);
    }

    /**
     * Laravel's default notification-broadcast channel name is derived from
     * the notifiable's FQCN (`App.Domain.Identity.Models.User.{id}` here),
     * which doesn't match the `App.Models.User.{id}` channel already
     * authorized in routes/channels.php — pin it explicitly so notification
     * broadcasts actually land on the channel the frontend subscribes to.
     */
    public function receivesBroadcastNotificationsOn(): string
    {
        return 'App.Models.User.'.$this->getKey();
    }

    /**
     * Overrides Laravel's default (link-only) verification email so it
     * also carries a 6-digit code — either one verifies the account (see
     * VerificationCodeService / AuthController::verifyEmailCode). Required
     * by the MustVerifyEmail contract, so it can't return the challenge
     * token itself — callers that need it call sendEmailVerificationCode()
     * directly instead.
     */
    public function sendEmailVerificationNotification(): void
    {
        $this->sendEmailVerificationCode();
    }

    /**
     * Same send as above, but returns the opaque challenge_token a caller
     * with no bearer token yet (a user who just registered) needs to later
     * submit the code without being authenticated — see RegisterUser and
     * ResendEmailVerification.
     */
    public function sendEmailVerificationCode(): string
    {
        $generated = app(VerificationCodeService::class)
            ->generate($this, VerificationCode::PURPOSE_EMAIL_VERIFICATION);

        $this->notify(new VerifyEmailWithCode($generated['code']));

        return $generated['challenge_token'];
    }

    /**
     * The session tied to whichever Sanctum token this instance is currently
     * carrying (set explicitly by callers via `withCurrentSession()` /
     * `setRelation()` — never resolved through the `auth()` helper, since
     * that would silently misbehave for any `User` other than the one
     * making the request).
     */
    public function currentSession(): HasOne
    {
        return $this->hasOne(UserSession::class)->whereRaw('1 = 0');
    }

    public function withCurrentSession(): static
    {
        $tokenId = $this->currentAccessToken()?->id;

        $this->setRelation(
            'currentSession',
            $tokenId ? $this->sessions()->where('personal_access_token_id', $tokenId)->first() : null
        );

        return $this;
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
            if (! $this->hasPermissionTo($permission)) {
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
