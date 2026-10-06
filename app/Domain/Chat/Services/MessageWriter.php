<?php

namespace App\Domain\Chat\Services;

use App\Domain\Chat\Actions\MarkMessageRead;
use App\Domain\Chat\Events\MessageSent;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Identity\Models\User;
use App\Domain\Notification\Services\ChatNotifier;
use App\Infrastructure\Broadcasting\LiveUpdates;

/**
 * What happens around every new message, whoever creates it (a send, a
 * forward, a poll, a service line): the conversation's last message, the
 * others' unread counts, archived or deleted-for-me chats coming back, the
 * sender's read pointer, the broadcast and the notifications.
 */
class MessageWriter
{
    public function __construct(
        private readonly ChatAccess $access,
        private readonly MessageHydrator $hydrator,
        private readonly ChatNotifier $notifier,
        private readonly MarkMessageRead $markRead,
    ) {}

    /**
     * Call inside the transaction that created `$message`.
     */
    public function record(Message $message): void
    {
        $conversationId = (int) $message->conversation_id;

        // Never backwards, even if two sends commit out of order.
        Conversation::query()
            ->whereKey($conversationId)
            ->where(fn ($query) => $query->whereNull('last_message_id')->orWhere('last_message_id', '<', $message->id))
            ->update([
                'last_message_id' => $message->id,
                'last_message_at' => $message->created_at,
            ]);

        $members = ConversationUser::query()
            ->where('conversation_id', $conversationId)
            ->whereNull('left_at');

        if (! $message->isSystem()) {
            (clone $members)
                ->where('user_id', '!=', (int) $message->user_id)
                ->increment('unread_count');

            // As in Telegram: a new message brings an archived chat back,
            // unless it is muted.
            (clone $members)
                ->whereNotNull('archived_at')
                ->where('notifications_enabled', true)
                ->where(fn ($query) => $query->whereNull('muted_until')->orWhere('muted_until', '<=', now()))
                ->update(['archived_at' => null]);
        }

        // A private chat deleted "for me" comes back with the next message.
        (clone $members)->where('is_hidden', true)->update(['is_hidden' => false]);
    }

    /**
     * Call after the transaction committed: moves the sender's read pointer,
     * broadcasts `message.sent` to every member (their other devices
     * included) and notifies — except for service messages.
     */
    public function announce(Message $message, User $sender, bool $notify = true): Message
    {
        $conversationId = (int) $message->conversation_id;
        $membership = ConversationUser::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $sender->id)
            ->whereNull('left_at')
            ->first();

        if ($membership && ! $message->isSystem()) {
            $this->markRead->advance($sender, $membership, (int) $message->id);
        }

        $this->hydrator->hydrate($message);

        $event = new MessageSent($this->access->memberIds($conversationId), $message);

        $message->isSystem() ? LiveUpdates::toEveryone($event) : LiveUpdates::toOthers($event);

        if ($notify && ! $message->isSystem()) {
            $conversation = Conversation::query()->with('users')->find($conversationId);

            if ($conversation) {
                $this->notifier->messageSent($sender, $conversation, $message);
            }
        }

        return $message;
    }
}
