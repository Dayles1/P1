<?php

namespace App\Http\Resources\Chat;

use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Identity\Models\User;
use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A member of a conversation. Other people's mute settings are theirs
 * alone and are not shown.
 *
 * @mixin User
 *
 * @property-read ConversationUser|null $pivot
 */
class ConversationMemberResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $pivot = $this->pivot;
        $formatter = app(UserDateFormatter::class);
        $viewer = $request->user();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'avatar' => $this->avatar?->url,
            'role' => $pivot?->role,
            'joined_at' => $formatter->format($pivot?->joined_at, $viewer),
            'joined_at_iso' => $formatter->iso($pivot?->joined_at, $viewer),
            'is_me' => (int) $this->id === (int) $viewer?->id,
            'last_seen_at' => $this->last_seen_at?->toIso8601String(),
        ];
    }
}
