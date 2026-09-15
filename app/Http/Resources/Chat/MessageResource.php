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
            'reply_to' => $this->whenLoaded('parent', fn () => $this->parent ? [
                'id' => $this->parent->id,
                'body' => $this->parent->body,
                'sender_name' => $this->parent->user?->name,
            ] : null),
            'type' => $this->type,
            'body' => $this->body,
            'is_pinned' => (bool) $this->is_pinned,
            'is_mine' => (int) $this->user_id === (int) $user?->id,
            'sender' => $this->whenLoaded('user', fn () => $this->user ? [
                'id' => $this->user->id,
                'name' => $this->user->name,
                'avatar' => $this->user->avatar?->url,
            ] : null),
            'attachments' => $this->whenLoaded('attachments', fn () => $this->attachments->map(fn ($attachment) => [
                'id' => $attachment->id,
                'url' => $attachment->url,
                'original_name' => $attachment->original_name,
                'mime_type' => $attachment->mime_type,
                'size' => $attachment->size,
                'width' => $attachment->width,
                'height' => $attachment->height,
            ])),
            'reactions' => $this->whenLoaded('reactions', fn () => $this->reactions
                ->groupBy('emoji')
                ->map(fn ($group, $emoji) => [
                    'emoji' => $emoji,
                    'count' => $group->count(),
                    'user_ids' => $group->pluck('user_id')->all(),
                ])
                ->values()),
            'read_by' => $this->whenLoaded('reads', fn () => $this->reads->pluck('user_id')->all()),
            'edited_at' => $formatter->format($this->edited_at, $user),
            'created_at' => $formatter->format($this->created_at, $user),
            'created_at_iso' => $formatter->iso($this->created_at, $user),
        ];
    }
}
