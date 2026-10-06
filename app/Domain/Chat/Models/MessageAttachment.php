<?php

namespace App\Domain\Chat\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MessageAttachment extends Model
{
    protected $fillable = [
        'message_id',
        'disk',
        'path',
        'original_name',
        'mime_type',
        'size',
        'width',
        'height',
        'duration',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'size' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'duration' => 'integer',
            'meta' => 'array',
        ];
    }

    /** @return BelongsTo<Message, $this> */
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }

    /**
     * What the attachment is for display: image, video, voice (a recorded
     * voice message), audio (an audio file) or file.
     */
    public function kind(): string
    {
        $mime = (string) $this->mime_type;
        $voice = $this->meta['voice'] ?? null;

        return match (true) {
            str_starts_with($mime, 'image/') => 'image',
            $voice === true => 'voice',
            str_starts_with($mime, 'video/') => 'video',
            str_starts_with($mime, 'audio/') => $voice === null && in_array(strtok($mime, ';'), ['audio/webm', 'audio/ogg', 'audio/opus'], true)
                ? 'voice'
                : 'audio',
            default => 'file',
        };
    }

    public function getUrlAttribute(): ?string
    {
        return $this->path ? \Storage::disk($this->disk)->url($this->path) : null;
    }
}
