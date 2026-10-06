<?php

namespace App\Domain\Chat\Events;

use App\Domain\Chat\Events\Concerns\BroadcastsToMembers;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * "A conversation appeared for you": sent to the people a conversation was
 * started with, or who were added to a group, so it shows up in their list
 * without a reload.
 */
class ConversationActivity implements ShouldBroadcastNow
{
    use BroadcastsToMembers, Dispatchable, InteractsWithSockets;

    public const REASON_MESSAGE = 'message';

    public const REASON_JOINED = 'joined';

    /**
     * @param  array<int, int>  $userIds
     */
    public function __construct(
        public array $userIds,
        public int $conversationId,
        public string $reason,
    ) {}

    public function broadcastAs(): string
    {
        return 'conversation.activity';
    }

    /** @return array{conversation_id: int, reason: string} */
    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'reason' => $this->reason,
        ];
    }
}
