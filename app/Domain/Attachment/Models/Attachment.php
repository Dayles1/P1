<?php

namespace App\Domain\Attachment\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Attachment extends Model
{
    protected $fillable = [
        'collection',
        'disk',
        'path',
        'original_name',
        'filename',
        'extension',
        'mime_type',
        'size',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
            'size' => 'integer',
        ];
    }


    public function attachable(): MorphTo
    {
        return $this->morphTo();
    }


    // public function url(): string
    // {
    //     return \Storage::disk($this->disk)
    //         ->url($this->path);
    // }
    public function getUrlAttribute(): ?string
    {
        return $this->path
            ? \Storage::disk($this->disk)->url($this->path)
            : null;
    }
}