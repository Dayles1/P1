<?php

namespace App\Domain\Chat\Events;

use App\Domain\Chat\Events\Concerns\BroadcastsToMembers;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Messages someone deleted for themselves only — sent to their own devices.
 */
class MessageHidden implements ShouldBroadcastNow
{
    use BroadcastsToMembers, Dispatchable, InteractsWithSockets;

    /**
     * @param  array<int, int>  $userIds
     * @param  array<int, int>  $messageIds
     */
    public function __construct(
        public array $userIds,
        public int $conversationId,
        public array $messageIds,
    ) {}

    public function broadcastAs(): string
    {
        return 'message.hidden';
    }

    /** @return array{conversation_id: int, message_ids: array<int, int>} */
    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'message_ids' => array_values($this->messageIds),
        ];
    }
}
