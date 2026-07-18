<?php

namespace App\Domain\Profile\Actions;

use App\Domain\Attachment\Models\Attachment;
use App\Domain\Identity\Models\User;
use App\Domain\Setting\Services\SettingService;
use App\Infrastructure\Storage\FileStorage;
use Illuminate\Http\UploadedFile;

class StoreAvatar
{
    public function __construct(
        protected FileStorage $fileStorage,
        protected SettingService $settingService,
    ) {}

    public function handle(User $user, UploadedFile $file): Attachment
    {
        if (! $this->settingService->boolean('user.allow_avatar_upload', true)) {
            abort(403, __('messages.profile.avatar_upload_disabled'));
        }

        $stored = $this->fileStorage->store(
            file: $file,
            directory: "avatars/{$user->id}",
            disk: 'public'
        );

        return $user->avatars()->create([
            'collection'    => 'avatar',
            'disk'          => $stored['disk'],
            'path'          => $stored['path'],
            'original_name' => $stored['name'],
            'filename'      => $stored['filename'],
            'extension'     => $stored['extension'],
            'mime_type'     => $stored['mime_type'],
            'size'          => $stored['size'],
        ]);
    }
}