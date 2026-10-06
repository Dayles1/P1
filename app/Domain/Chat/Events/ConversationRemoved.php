<?php

namespace App\Domain\Chat\Events;

use App\Domain\Chat\Events\Concerns\BroadcastsToMembers;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * A conversation went away for these people: they were removed, they left,
 * it was deleted, or (`cleared`) its history was cleared for them.
 */
class ConversationRemoved implements ShouldBroadcastNow
{
    use BroadcastsToMembers, Dispatchable, InteractsWithSockets;

    public const REASON_REMOVED = 'removed';

    public const REASON_LEFT = 'left';

    public const REASON_DELETED = 'deleted';

    public const REASON_CLEARED = 'cleared';

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
        return 'conversation.removed';
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
