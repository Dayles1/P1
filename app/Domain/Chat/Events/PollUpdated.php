<?php

namespace App\Domain\Chat\Events;

use App\Domain\Chat\Events\Concerns\BroadcastsToMembers;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * A poll's results changed (a vote, a retracted vote, or it was closed).
 * `poll` carries no `my_votes` — every client keeps its own.
 */
class PollUpdated implements ShouldBroadcastNow
{
    use BroadcastsToMembers, Dispatchable, InteractsWithSockets;

    /**
     * @param  array<int, int>  $userIds
     * @param  array<string, mixed>  $poll
     */
    public function __construct(
        public array $userIds,
        public int $conversationId,
        public int $messageId,
        public array $poll,
    ) {}

    public function broadcastAs(): string
    {
        return 'poll.updated';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'message_id' => $this->messageId,
            'poll' => $this->poll,
        ];
    }
}
