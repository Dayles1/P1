<?php

namespace App\Domain\Chat\Services;

use App\Domain\Chat\Exceptions\ChatForbidden;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserBlock;
use Illuminate\Database\Eloquent\ModelNotFoundException;

/**
 * Who is in a conversation and what they may do in it. Every chat action
 * goes through here, so "a member who left is not a member" and "a channel
 * is read-only for ordinary members" hold everywhere.
 */
class ChatAccess
{
    /**
     * The requester's active membership, with its conversation loaded.
     * Not a member (or left) → 404, so ids of other people's chats are not probed.
     */
    public function membership(User $user, int $conversationId): ConversationUser
    {
        $membership = ConversationUser::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->with('conversation')
            ->first();

        if (! $membership || ! $membership->conversation) {
            throw (new ModelNotFoundException)->setModel(Conversation::class, [$conversationId]);
        }

        return $membership;
    }

    /**
     * Ids of everyone currently in the conversation.
     *
     * @return array<int, int>
     */
    public function memberIds(int $conversationId): array
    {
        return ConversationUser::query()
            ->where('conversation_id', $conversationId)
            ->whereNull('left_at')
            ->orderBy('user_id')
            ->pluck('user_id')
            ->map(fn ($id): int => (int) $id)
            ->all();
    }

    /**
     * The other person in a private chat, or null.
     */
    public function otherParticipantId(Conversation $conversation, int $userId): ?int
    {
        if ($conversation->type !== Conversation::TYPE_PRIVATE) {
            return null;
        }

        $id = ConversationUser::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', '!=', $userId)
            ->orderBy('id')
            ->value('user_id');

        return $id !== null ? (int) $id : null;
    }

    /**
     * Whether the member may post messages here. Private: no block in
     * either direction. Channel: creator and admins only. Saved: its owner.
     */
    public function canPost(ConversationUser $membership): bool
    {
        return $this->postingDeniedReason($membership) === null;
    }

    public function ensureCanPost(ConversationUser $membership): void
    {
        $reason = $this->postingDeniedReason($membership);

        if ($reason === 'chat.blocked') {
            throw ChatForbidden::because('chat.blocked', 'messages.chat.blocked');
        }

        if ($reason !== null) {
            throw ChatForbidden::because($reason, 'messages.chat.cannot_post');
        }
    }

    public function postingDeniedReason(ConversationUser $membership): ?string
    {
        $conversation = $membership->conversation;

        return match ($conversation->type) {
            Conversation::TYPE_CHANNEL => $membership->isManager() ? null : 'chat.channel_read_only',
            Conversation::TYPE_SAVED => (int) $conversation->created_by === (int) $membership->user_id ? null : 'chat.forbidden',
            Conversation::TYPE_PRIVATE => $this->isBlockedInPrivate($conversation, (int) $membership->user_id) ? 'chat.blocked' : null,
            default => null,
        };
    }

    public function isBlockedInPrivate(Conversation $conversation, int $userId): bool
    {
        $otherId = $this->otherParticipantId($conversation, $userId);

        if ($otherId === null) {
            return false;
        }

        return UserBlock::query()
            ->where(fn ($query) => $query->where('user_id', $userId)->where('blocked_user_id', $otherId))
            ->orWhere(fn ($query) => $query->where('user_id', $otherId)->where('blocked_user_id', $userId))
            ->exists();
    }

    /**
     * Creator or admin of a group or channel.
     */
    public function ensureManager(ConversationUser $membership): void
    {
        if (! $this->isGroupLike($membership->conversation) || ! $membership->isManager()) {
            throw ChatForbidden::because('chat.not_manager');
        }
    }

    public function ensureCreator(ConversationUser $membership): void
    {
        if (! $this->isGroupLike($membership->conversation) || $membership->role !== ConversationUser::ROLE_CREATOR) {
            throw ChatForbidden::because('chat.not_creator');
        }
    }

    public function isGroupLike(Conversation $conversation): bool
    {
        return in_array($conversation->type, [Conversation::TYPE_GROUP, Conversation::TYPE_CHANNEL], true);
    }
}
