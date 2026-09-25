<?php

namespace App\Domain\Profile\Actions;

use App\Domain\Attachment\Models\Attachment;
use App\Domain\Identity\Models\User;
use App\Domain\Setting\Services\SettingService;
use App\Infrastructure\Storage\FileStorage;
use Illuminate\Http\UploadedFile;

/**
 * Sets a user's avatar. Only the current one is kept: once the new file
 * is stored, every earlier avatar — its file and its row — is deleted,
 * so storage holds one avatar per user rather than their whole history.
 */
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

        $avatar = $user->avatars()->create([
            'collection' => 'avatar',
            'disk' => $stored['disk'],
            'path' => $stored['path'],
            'original_name' => $stored['name'],
            'filename' => $stored['filename'],
            'extension' => $stored['extension'],
            'mime_type' => $stored['mime_type'],
            'size' => $stored['size'],
        ]);

        $this->deleteOthers($user, $avatar);

        return $avatar;
    }

    /**
     * Deletes every avatar of the user's except `$current`. The new one
     * is saved first, so a failure here never leaves a user without one.
     */
    public function deleteOthers(User $user, Attachment $current): int
    {
        $previous = $user->avatars()->whereKeyNot($current->getKey())->get();

        foreach ($previous as $avatar) {
            if ($avatar->path && $avatar->path !== $current->path) {
                $this->fileStorage->delete(path: $avatar->path, disk: $avatar->disk);
            }

            $avatar->delete();
        }

        return $previous->count();
    }
}
