<?php

namespace App\Http\Resources\User;

use App\Domain\Chat\Models\MessageAttachment;
use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A file from a conversation two people share, as their profile lists it.
 *
 * @mixin MessageAttachment
 */
class SharedAttachmentResource extends JsonResource
{
    /**
     * @return array{id: int, message_id: int, conversation_id: int|null, sender_id: int|null, url: string|null, original_name: string|null, mime_type: string|null, size: int|null, width: int|null, height: int|null, duration: int|null, kind: string, created_at_iso: string|null}
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'message_id' => $this->message_id,
            'conversation_id' => $this->message?->conversation_id,
            'sender_id' => $this->message?->user_id,
            'url' => $this->url,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'size' => $this->size,
            'width' => $this->width,
            'height' => $this->height,
            'duration' => $this->duration,
            'kind' => self::kind($this->resource),
            'created_at_iso' => app(UserDateFormatter::class)->iso($this->message->created_at ?? $this->created_at, $request->user()),
        ];
    }

    /** image, video, voice, audio or file — from the MIME type and the voice flag. */
    public static function kind(MessageAttachment $attachment): string
    {
        $mime = (string) $attachment->mime_type;

        return match (true) {
            str_starts_with($mime, 'image/') => 'image',
            str_starts_with($mime, 'video/') => 'video',
            str_starts_with($mime, 'audio/') => ($attachment->meta['voice'] ?? false) ? 'voice' : 'audio',
            default => 'file',
        };
    }
}
