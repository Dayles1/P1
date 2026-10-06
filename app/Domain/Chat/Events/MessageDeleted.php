<?php

namespace App\Domain\Chat\Events;

use App\Domain\Chat\Events\Concerns\BroadcastsToMembers;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Messages deleted for everyone. `last_message` is the conversation's new
 * last message (for the chat list), or null when none is left.
 */
class MessageDeleted implements ShouldBroadcastNow
{
    use BroadcastsToMembers, Dispatchable, InteractsWithSockets;

    /**
     * @param  array<int, int>  $userIds
     * @param  array<int, int>  $messageIds
     * @param  array<string, mixed>|null  $lastMessage
     */
    public function __construct(
        public array $userIds,
        public int $conversationId,
        public array $messageIds,
        public ?array $lastMessage = null,
    ) {}

    public function broadcastAs(): string
    {
        return 'message.deleted';
    }

    /** @return array{conversation_id: int, message_ids: array<int, int>, last_message: array<string, mixed>|null} */
    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'message_ids' => array_values($this->messageIds),
            'last_message' => $this->lastMessage,
        ];
    }
}
