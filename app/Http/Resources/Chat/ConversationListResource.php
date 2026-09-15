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

            'title' => $this->type === 'private' ? $otherUser?->name : $this->title,

            'is_pinned' => (bool) ($this->pivot?->is_pinned),
            'is_muted' => (bool) ($this->pivot?->muted_until && $this->pivot->muted_until->isFuture()),
            'avatar' => $this->type === 'private' ? $otherUser?->avatar?->url : $this->avatar,
            'other_user_id' => $this->type === 'private' ? $otherUser?->id : null,
            'unread_count' => $this->pivot?->unread_count ?? 0,
            'last_message' => $this->lastMessage ? [
                'id' => $this->lastMessage->id,
                'body' => $this->lastMessage->body,
                'type' => $this->lastMessage->type,
                'sender' => $this->lastMessage->user?->name,

                'created_at' => $formatter->format($this->lastMessage->created_at, $user),
            ] : null,
            'last_message_at' => $formatter->format($this->last_message_at, $user),
        ];
    }
}
