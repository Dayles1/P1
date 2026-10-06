<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Attachment\Models\Attachment;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\ConversationBroadcaster;
use App\Domain\Chat\Services\SystemMessages;
use App\Domain\Identity\Models\User;
use App\Infrastructure\Storage\FileStorage;
use Illuminate\Http\UploadedFile;

/**
 * A group's or channel's photo — creator and admins only. Stored as the
 * conversation's `avatar` attachment; the previous photo is deleted.
 */
class UpdateConversationAvatar
{
    public function __construct(
        private readonly ChatAccess $access,
        private readonly FileStorage $fileStorage,
        private readonly SystemMessages $systemMessages,
        private readonly ConversationBroadcaster $broadcaster,
    ) {}

    public function store(User $user, int $conversationId, UploadedFile $file): Conversation
    {
        $membership = $this->access->membership($user, $conversationId);
        $this->access->ensureManager($membership);
        $conversation = $membership->conversation;

        $stored = $this->fileStorage->store($file, "chat-avatars/{$conversation->id}", 'public');

        $this->deleteCurrent($conversation);

        $conversation->avatarAttachment()->create([
            'collection' => 'avatar',
            'disk' => $stored['disk'],
            'path' => $stored['path'],
            'original_name' => $stored['name'],
            'filename' => $stored['filename'],
            'extension' => $stored['extension'],
            'mime_type' => $stored['mime_type'],
            'size' => $stored['size'],
        ]);

        $this->systemMessages->post($conversation, $user, SystemMessages::AVATAR_CHANGED);
        $this->broadcaster->updated($conversation, 'avatar');

        return $conversation->refresh()->load('avatarAttachment');
    }

    public function destroy(User $user, int $conversationId): Conversation
    {
        $membership = $this->access->membership($user, $conversationId);
        $this->access->ensureManager($membership);
        $conversation = $membership->conversation;

        if ($this->deleteCurrent($conversation)) {
            $this->systemMessages->post($conversation, $user, SystemMessages::AVATAR_REMOVED);
            $this->broadcaster->updated($conversation, 'avatar');
        }

        return $conversation->refresh()->load('avatarAttachment');
    }

    private function deleteCurrent(Conversation $conversation): bool
    {
        $current = Attachment::query()
            ->where('attachable_type', $conversation->getMorphClass())
            ->where('attachable_id', $conversation->id)
            ->where('collection', 'avatar')
            ->get();

        foreach ($current as $attachment) {
            $this->fileStorage->delete((string) $attachment->path, (string) $attachment->disk);
            $attachment->delete();
        }

        return $current->isNotEmpty();
    }
}
