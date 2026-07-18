<?php

namespace App\Http\Resources\Chat;

use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ConversationShowResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $formatter = app(UserDateFormatter::class);

        $user = $request->user();

        return [
            'id' => $this->id,
            'type' => $this->type,
            'title' => $this->title,
            'avatar' => $this->avatar?->url(),
            'created_by' => $this->created_by,
            'creator' => $this->whenLoaded('creator', function () {
                return [
                    'id' => $this->creator?->id,
                    'name' => $this->creator?->name,
                    'avatar' => $this->creator?->avatar?->url(),
                ];
            }),
            'is_locked' => (bool) $this->is_locked,
            'is_archived' => (bool) $this->is_archived,
            'meta' => $this->meta,
            'members_count' => $this->users_count,
            'created_at' => $formatter->format($this->created_at,$user),
            'updated_at' => $formatter->format($this->updated_at,$user),
        ];
    }
}