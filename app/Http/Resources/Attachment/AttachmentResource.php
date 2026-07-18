<?php

namespace App\Http\Resources\Attachment;

use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Number;

class AttachmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $formatter = app(UserDateFormatter::class);
        $user = $request->user();

        return [
            'id'             => $this->id,
            'collection'     => $this->collection,
            'disk'           => $this->disk,
            'path'           => $this->path,
            'original_name'  => $this->original_name,
            'filename'       => $this->filename,
            'extension'      => $this->extension,
            'mime_type'      => $this->mime_type,
            'size'           => $this->size,
            'size_human'     => Number::fileSize($this->size),
            'url'            => $this->url,
            'created_at'     => $formatter->format($this->created_at, $user),
        ];
    }
}