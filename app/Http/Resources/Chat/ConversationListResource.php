<?php

namespace App\Http\Resources\Chat;

use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ConversationListResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $formatter = app(UserDateFormatter::class);

        $user = $request->user();

        $otherUser = null;

        if ($this->type === 'private') {
            $otherUser = $this->users->firstWhere('id', '!=', $user->id);
        }

        return [
            'id' => $this->id,
            'type' => $this->type,

            'title' => $this->type === 'private'? $otherUser?->name: $this->name,

            'is_pinned' => (bool) ($this->pivot?->is_pinned),
            'avatar' => $this->type === 'private'? $otherUser?->avatar?->url(): $this->avatar?->url(),
            'unread_count' => $this->pivot?->unread_count ?? 0,
            'last_message' => $this->lastMessage ? [
                'id' => $this->lastMessage->id,
                'body' => $this->lastMessage->body,
                'type' => $this->lastMessage->type,
                'sender' => $this->lastMessage->user?->name,

                'created_at' => $formatter->format($this->lastMessage->created_at,$user),
            ] : null,
            'last_message_at' => $formatter->format($this->last_message_at,$user),
        ];
    }
}