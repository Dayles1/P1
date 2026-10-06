<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Events\MessageDeleted;
use App\Domain\Chat\Events\MessageHidden;
use App\Domain\Chat\Exceptions\ChatForbidden;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Models\MessageUserHide;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\ConversationPresenter;
use App\Domain\Chat\Services\UnreadCounter;
use App\Domain\Identity\Models\User;
use App\Infrastructure\Broadcasting\LiveUpdates;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;

/**
 * Deletes one or more messages.
 *
 * - `everyone`: your own messages, or any message for the creator and
 *   admins of a group or channel (or with an explicit `delete_message`
 *   grant). Soft-deleted for all; the chat's last message and everyone's
 *   unread count are recomputed and `message.deleted` goes to all members.
 * - `me`: any message; hidden only for you, and only your own devices
 *   hear about it (`message.hidden`).
 */
class DeleteMessage
{
    public const FOR_EVERYONE = 'everyone';

    public const FOR_ME = 'me';

    public function __construct(
        private readonly ChatAccess $access,
        private readonly UnreadCounter $unreadCounter,
        private readonly ConversationPresenter $presenter,
    ) {}

    /**
     * @param  array<int, int>  $messageIds
     * @return array{deleted_ids: array<int, int>, hidden_ids: array<int, int>}
     */
    public function handle(User $user, int $conversationId, array $messageIds, string $for = self::FOR_EVERYONE, bool $failWhenMissing = false): array
    {
        $membership = $this->access->membership($user, $conversationId);

        $messages = Message::query()
            ->where('conversation_id', $conversationId)
            ->whereIn('id', array_map('intval', $messageIds))
            ->when($membership->cleared_up_to_message_id, fn ($query, $clearedUpTo) => $query->where('id', '>', (int) $clearedUpTo))
            ->orderBy('id')
            ->get();

        if ($failWhenMissing && $messages->isEmpty()) {
            throw (new ModelNotFoundException)->setModel(Message::class, $messageIds);
        }

        if ($messages->isEmpty()) {
            return ['deleted_ids' => [], 'hidden_ids' => []];
        }

        return $for === self::FOR_ME
            ? ['deleted_ids' => [], 'hidden_ids' => $this->hideForMe($user, $membership, $messages)]
            : ['deleted_ids' => $this->deleteForEveryone($membership, $messages), 'hidden_ids' => []];
    }

    /**
     * @param  Collection<int, Message>  $messages
     * @return array<int, int>
     */
    private function deleteForEveryone(ConversationUser $membership, Collection $messages): array
    {
        foreach ($messages as $message) {
            if (! $this->canDeleteForEveryone($membership, $message)) {
                throw new ChatForbidden('chat.cannot_delete', __('messages.chat.cannot_delete'));
            }
        }

        $conversation = $membership->conversation;
        $ids = $messages->pluck('id')->map(fn ($id): int => (int) $id)->all();

        DB::transaction(function () use ($conversation, $ids): void {
            Message::query()->whereIn('id', $ids)->update([
                'deleted_at' => now(),
                'is_pinned' => false,
            ]);

            $this->refreshLastMessage($conversation);
            $this->unreadCounter->recompute($conversation->id);
        });

        // The bell should not keep counting what no longer exists.
        DB::table('notifications')
            ->whereIn('message_id', $ids)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $conversation->refresh();
        $lastMessage = $conversation->lastMessage;

        LiveUpdates::toOthers(new MessageDeleted(
            $this->access->memberIds($conversation->id),
            $conversation->id,
            $ids,
            $lastMessage ? $this->presenter->lastMessage($lastMessage, null) : null,
        ));

        return $ids;
    }

    /**
     * @param  Collection<int, Message>  $messages
     * @return array<int, int>
     */
    private function hideForMe(User $user, ConversationUser $membership, Collection $messages): array
    {
        $ids = $messages->pluck('id')->map(fn ($id): int => (int) $id)->all();
        $now = now();

        MessageUserHide::query()->insertOrIgnore(array_map(fn (int $id): array => [
            'message_id' => $id,
            'user_id' => $user->id,
            'created_at' => $now,
        ], $ids));

        $this->unreadCounter->recompute((int) $membership->conversation_id, [(int) $user->id]);

        LiveUpdates::toOthers(new MessageHidden([(int) $user->id], (int) $membership->conversation_id, $ids));

        return $ids;
    }

    private function canDeleteForEveryone(ConversationUser $membership, Message $message): bool
    {
        if ($this->access->isGroupLike($membership->conversation) && $membership->isManager()) {
            return true;
        }

        if ($message->isSystem()) {
            return false;
        }

        return ChatPermissions::canModify($membership, $message, 'delete_message');
    }

    /**
     * Points the conversation at its newest remaining message (or none).
     */
    public function refreshLastMessage(Conversation $conversation): void
    {
        $latest = Message::query()
            ->where('conversation_id', $conversation->id)
            ->orderByDesc('id')
            ->first(['id', 'created_at']);

        Conversation::query()->whereKey($conversation->id)->update([
            'last_message_id' => $latest?->id,
            'last_message_at' => $latest->created_at ?? $conversation->last_message_at,
        ]);
    }
}
