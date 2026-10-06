<?php

namespace App\Domain\Chat\Events;

use App\Domain\Chat\Events\Concerns\BroadcastsToMembers;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * `user_id` has read everything up to and including `message_id`. Sent to
 * every member — the reader's own other devices use `unread_count` (the
 * reader's) to update their badge.
 */
class MessageRead implements ShouldBroadcastNow
{
    use BroadcastsToMembers, Dispatchable, InteractsWithSockets;

    /**
     * @param  array<int, int>  $userIds
     */
    public function __construct(
        public array $userIds,
        public int $conversationId,
        public int $userId,
        public int $messageId,
        public string $readAtIso,
        public int $unreadCount,
    ) {}

    public function broadcastAs(): string
    {
        return 'message.read';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'user_id' => $this->userId,
            'message_id' => $this->messageId,
            'read_at_iso' => $this->readAtIso,
            'unread_count' => $this->unreadCount,
        ];
    }
}
