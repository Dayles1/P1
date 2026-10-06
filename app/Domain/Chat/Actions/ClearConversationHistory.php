<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Events\ConversationRemoved;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\ConversationBroadcaster;
use App\Domain\Identity\Models\User;

/**
 * Clears a chat's history for the member only: everything up to the
 * current last message disappears for them; others keep it.
 */
class ClearConversationHistory
{
    public function __construct(
        private readonly ChatAccess $access,
        private readonly ConversationBroadcaster $broadcaster,
    ) {}

    public function handle(User $user, int $conversationId, bool $hide = false): ConversationUser
    {
        $membership = $this->access->membership($user, $conversationId);
        $lastMessageId = $membership->conversation->last_message_id;

        ConversationUser::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $user->id)
            ->update([
                'cleared_up_to_message_id' => $lastMessageId,
                'last_read_message_id' => $lastMessageId ?? $membership->last_read_message_id,
                'last_read_at' => now(),
                'unread_count' => 0,
                'marked_unread' => false,
                ...($hide ? ['is_hidden' => true, 'is_pinned' => false, 'pinned_at' => null] : []),
            ]);

        $this->broadcaster->removed([(int) $user->id], $conversationId, ConversationRemoved::REASON_CLEARED);

        return ConversationUser::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $user->id)
            ->firstOrFail();
    }
}
