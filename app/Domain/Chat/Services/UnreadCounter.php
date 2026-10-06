<?php

namespace App\Domain\Chat\Services;

use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use Illuminate\Support\Facades\DB;

/**
 * Recomputes `conversation_users.unread_count` from the messages
 * themselves: messages from others, after the member's read pointer and
 * cleared-history marker, not deleted, not hidden for them, and not
 * service messages. Used wherever a plain increment/reset would drift
 * (reading only part of a chat, deleting messages).
 */
class UnreadCounter
{
    /**
     * @param  array<int, int>|null  $userIds  only these members (null: everyone in the chat)
     */
    public function recompute(int $conversationId, ?array $userIds = null): void
    {
        $query = ConversationUser::query()
            ->where('conversation_id', $conversationId)
            ->whereNull('left_at');

        if ($userIds !== null) {
            if ($userIds === []) {
                return;
            }

            $query->whereIn('user_id', $userIds);
        }

        $query->update(['unread_count' => DB::raw('('.$this->countSql().')')]);
    }

    public function countFor(int $conversationId, int $userId): int
    {
        $membership = ConversationUser::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $userId)
            ->first(['last_read_message_id', 'cleared_up_to_message_id']);

        return Message::query()
            ->where('conversation_id', $conversationId)
            ->where('type', '!=', Message::TYPE_SYSTEM)
            ->where(fn ($query) => $query->whereNull('user_id')->orWhere('user_id', '!=', $userId))
            ->where('id', '>', max((int) $membership?->last_read_message_id, (int) $membership?->cleared_up_to_message_id))
            ->whereNotExists(fn ($query) => $query->selectRaw('1')
                ->from('message_user_hides')
                ->whereColumn('message_user_hides.message_id', 'messages.id')
                ->where('message_user_hides.user_id', $userId))
            ->count();
    }

    /**
     * @return literal-string
     */
    private function countSql(): string
    {
        return "select count(*) from messages as m
            where m.conversation_id = conversation_users.conversation_id
              and m.deleted_at is null
              and m.type <> '".Message::TYPE_SYSTEM."'
              and (m.user_id is null or m.user_id <> conversation_users.user_id)
              and m.id > coalesce(conversation_users.last_read_message_id, 0)
              and m.id > coalesce(conversation_users.cleared_up_to_message_id, 0)
              and not exists (
                  select 1 from message_user_hides as h
                  where h.message_id = m.id and h.user_id = conversation_users.user_id
              )";
    }
}
