<?php

namespace App\Http\Resources\Admin;

use App\Domain\Identity\Models\User;
use App\Domain\Setting\Services\UserDateFormatter;
use App\Http\Resources\Profile\AvatarResource;
use App\Http\Resources\Profile\BanResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class AdminUserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $formatter = app(UserDateFormatter::class);
        $viewer = $request->user();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'email_verified' => $this->email_verified_at !== null,

            'roles' => $this->whenLoaded('roles', fn () => $this->roles->map(fn ($role) => [
                'id' => $role->id,
                'name' => $role->name,
                'code' => $role->code,
            ])->values()),

            'avatar' => $this->whenLoaded('avatar', fn () => $this->avatar ? new AvatarResource($this->avatar) : null),

            'ban' => $this->whenLoaded('ban', fn () => $this->ban ? new BanResource($this->ban) : null),
            'is_banned' => $this->relationLoaded('ban') ? $this->isBanned() : null,

            'created_at' => $formatter->format($this->created_at, $viewer),
        ];
    }
}
