<?php

namespace App\Http\Resources\Profile;

use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProfileResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $rolePermissions = $this->whenLoaded('roles', function () {
            return $this->roles
                ->flatMap(fn($role) => $role->permissions)
                ->unique('id')
                ->values();
        }, collect());

        $directPermissions = $this->whenLoaded('permissions', fn() => $this->permissions, collect());

        $allPermissions = $rolePermissions
            ->merge($directPermissions)
            ->unique('id')
            ->values();

        $formatter = app(UserDateFormatter::class);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,

            'department' => $this->department ? [
                'id' => $this->department->id,
                'name' => $this->department->name,
            ] : null,

            'roles' => $this->roles->map(fn($role) => [
                'id' => $role->id,
                'name' => $role->name,
                'code' => $role->code,
            ])->values(),

            'permissions' => $directPermissions->map(fn($permission) => [
                'id' => $permission->id,
                'name' => $permission->name,
                'code' => $permission->code,
            ])->values(),

            'all_permissions' => $allPermissions->map(fn($permission) => [
                'id' => $permission->id,
                'name' => $permission->name,
                'code' => $permission->code,
            ])->values(),

            'ban' => $this->whenLoaded(
                'ban',
                fn() => new BanResource($this->ban)
            ),

            'avatar' => $this->whenLoaded(
                'avatar',
                fn() => new AvatarResource($this->avatar)
            ),

            'current_session' => $this->relationLoaded('currentSession') && $this->currentSession
                ? new UserSessionResource($this->currentSession)
                : null,

            'settings' => $this->relationLoaded('settings') && $this->settings
                ? new UserSettingResource($this->settings)
                : null,

            'created_at' => $formatter->format($this->created_at, $this->resource),
            'updated_at' => $formatter->format($this->updated_at, $this->resource),
        ];
    }
}