<?php

namespace App\Infrastructure\Storage;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FileStorage
{
    public function store(
        UploadedFile $file,
        string $directory,
        string $disk = 'public'
    ): array {
        $extension = $file->extension();

        $filename = sprintf(
            '%s.%s',
            Str::uuid()->toString(),
            $extension
        );

        $path = $file->storeAs(
            $directory,
            $filename,
            $disk
        );

        return [
            'path' => $path,
            'disk' => $disk,
            'name' => $file->getClientOriginalName(),
            'filename' => $filename,
            'extension' => $extension,
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
        ];
    }


    public function delete(
        string $path,
        string $disk = 'public'
    ): bool {
        return Storage::disk($disk)->delete($path);
    }


    public function exists(
        string $path,
        string $disk = 'public'
    ): bool {
        return Storage::disk($disk)->exists($path);
    }


    public function url(
        string $path,
        string $disk = 'public'
    ): string {
        return Storage::disk($disk)->url($path);
    }


    public function size(
        string $path,
        string $disk = 'public'
    ): int {
        return Storage::disk($disk)->size($path);
    }


    public function mimeType(
        string $path,
        string $disk = 'public'
    ): string|false {
        return Storage::disk($disk)->mimeType($path);
    }
}