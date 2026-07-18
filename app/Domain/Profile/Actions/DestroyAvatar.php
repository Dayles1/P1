<?php

namespace App\Domain\Profile\Actions;

use App\Domain\Identity\Models\User;
use App\Infrastructure\Storage\FileStorage;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class DestroyAvatar
{
    public function __construct(
        protected FileStorage $fileStorage,
    ) {}

    public function handle(User $user, int $avatarId): void
    {
        $avatar = $user->avatars()->whereKey($avatarId)->first();

        if (! $avatar) {
            throw new NotFoundHttpException(__('messages.not_found'));
        }

        if ($avatar->path) {
            $this->fileStorage->delete(
                path: $avatar->path,
                disk: $avatar->disk
            );
        }

        $avatar->delete();
    }
}