<?php

namespace App\Http\Resources\Chat;

use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class MessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $formatter = app(UserDateFormatter::class);
        $user = $request->user();

        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'parent_message_id' => $this->parent_message_id,
            'type' => $this->type,
            'body' => $this->body,
            'is_mine' => (int) $this->user_id === (int) $user?->id,
            'sender' => $this->whenLoaded('user', fn () => $this->user ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'avatar' => $this->user->avatar?->url(),
            ] : null),
            'edited_at' => $formatter->format($this->edited_at, $user),
            'created_at' => $formatter->format($this->created_at, $user),
            'created_at_iso' => $formatter->iso($this->created_at, $user),
        ];
    }
}
