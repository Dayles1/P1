<?php

namespace App\Domain\Chat\Events;

use App\Domain\Chat\Events\Concerns\BroadcastsToMembers;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class MessageReactionToggled implements ShouldBroadcastNow
{
    use BroadcastsToMembers, Dispatchable, InteractsWithSockets;

    /**
     * @param  array<int, int>  $userIds
     * @param  array<int, array{emoji: string, count: int, user_ids: array<int, int>}>  $reactions
     */
    public function __construct(
        public array $userIds,
        public int $conversationId,
        public int $messageId,
        public array $reactions,
        public int $userId,
        public string $emoji,
        public bool $added,
    ) {}

    public function broadcastAs(): string
    {
        return 'message.reaction.toggled';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'message_id' => $this->messageId,
            'reactions' => $this->reactions,
            'user_id' => $this->userId,
            'emoji' => $this->emoji,
            'added' => $this->added,
        ];
    }
}
