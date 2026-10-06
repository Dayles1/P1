<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Attachment\Models\Attachment;
use App\Domain\Chat\Events\ConversationRemoved;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\MessageAttachment;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\ConversationBroadcaster;
use App\Domain\Identity\Models\User;
use App\Infrastructure\Storage\FileStorage;
use Illuminate\Support\Facades\DB;

/**
 * "Delete chat".
 *
 * - Group or channel: the creator deletes it for everyone (files too).
 * - Private chat: delete for me — the history is cleared and the chat
 *   hidden for me, without leaving it; the next message brings it back,
 *   and starting a chat with that person again finds this one.
 * - Saved Messages: its history is cleared.
 */
class DeleteConversation
{
    public function __construct(
        private readonly ChatAccess $access,
        private readonly ConversationBroadcaster $broadcaster,
        private readonly ClearConversationHistory $clearHistory,
        private readonly FileStorage $fileStorage,
    ) {}

    public function handle(User $user, int $conversationId): void
    {
        $membership = $this->access->membership($user, $conversationId);
        $conversation = $membership->conversation;

        if (! $this->access->isGroupLike($conversation)) {
            $this->clearHistory->handle($user, $conversationId, hide: $conversation->type === Conversation::TYPE_PRIVATE);

            return;
        }

        $this->access->ensureCreator($membership);

        $memberIds = $this->access->memberIds($conversationId);

        $this->purge($conversation);

        $this->broadcaster->removed($memberIds, $conversationId, ConversationRemoved::REASON_DELETED);
    }

    /**
     * Deletes the conversation with its messages and their files (a file a
     * forwarded copy elsewhere still uses is kept).
     */
    public function purge(Conversation $conversation): void
    {
        $files = MessageAttachment::query()
            ->whereIn('message_id', fn ($query) => $query->select('id')->from('messages')->where('conversation_id', $conversation->id))
            ->get(['id', 'disk', 'path']);

        $avatars = Attachment::query()
            ->where('attachable_type', $conversation->getMorphClass())
            ->where('attachable_id', $conversation->id)
            ->get();

        DB::transaction(function () use ($conversation, $avatars): void {
            $avatars->each->delete();
            $conversation->delete();
        });

        foreach ($files as $file) {
            $stillUsed = MessageAttachment::query()
                ->where('disk', $file->disk)
                ->where('path', $file->path)
                ->exists();

            if (! $stillUsed) {
                $this->fileStorage->delete((string) $file->path, (string) $file->disk);
            }
        }

        foreach ($avatars as $avatar) {
            $this->fileStorage->delete((string) $avatar->path, (string) $avatar->disk);
        }
    }
}
