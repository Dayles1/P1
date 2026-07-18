<?php

namespace App\Http\Resources\Chat;

use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ConversationMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $pivot = $this->pivot;

        $formatter = app(UserDateFormatter::class);

        $user = $request->user();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'avatar' => $this->avatar?->url(),
            'role' => $pivot?->role,
            'joined_at' => $formatter->format($pivot?->joined_at,$user),
            'muted_until' => $formatter->format($pivot?->muted_until,$user),
            'is_me' => $this->id === $user?->id,
        ];
    }
}