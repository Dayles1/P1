<?php

namespace App\Http\Resources\User;

use App\Domain\Identity\Models\User;
use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One person in the people directory.
 *
 * @mixin User
 */
class DirectoryUserResource extends JsonResource
{
    /**
     * @return array{id: int, name: string, email: string, avatar: string|null, department: string|null, role: string|null, last_seen_at: string|null, is_banned: bool}
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'avatar' => $this->avatar?->url,
            // No FK set means no query — see BelongsTo::getResults().
            'department' => $this->department?->getTranslation('name'),
            'role' => $this->primaryRole()?->name,
            'last_seen_at' => app(UserDateFormatter::class)->iso($this->last_seen_at, $request->user()),
            'is_banned' => $this->isBanned(),
        ];
    }
}
