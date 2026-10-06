<?php

namespace App\Domain\Chat\Events;

use App\Domain\Chat\Events\Concerns\BroadcastsToMembers;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * A conversation's title, description, photo, members, roles or (for a
 * private chat) block state changed. `reason` says which.
 */
class ConversationUpdated implements ShouldBroadcastNow
{
    use BroadcastsToMembers, Dispatchable, InteractsWithSockets;

    /**
     * @param  array<int, int>  $userIds
     */
    public function __construct(
        public array $userIds,
        public int $conversationId,
        public ?string $title,
        public ?string $description,
        public ?string $avatar,
        public int $membersCount,
        public string $reason,
    ) {}

    public function broadcastAs(): string
    {
        return 'conversation.updated';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'title' => $this->title,
            'description' => $this->description,
            'avatar' => $this->avatar,
            'members_count' => $this->membersCount,
            'reason' => $this->reason,
        ];
    }
}
