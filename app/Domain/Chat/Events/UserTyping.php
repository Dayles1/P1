<?php

namespace App\Domain\Chat\Events;

use App\Domain\Chat\Events\Concerns\BroadcastsToMembers;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/** Dispatched synchronously (not queued) — a typing indicator that arrives a second late is worse than useless. */
class UserTyping implements ShouldBroadcastNow
{
    use BroadcastsToMembers, Dispatchable, InteractsWithSockets;

    public const KINDS = ['typing', 'recording', 'uploading'];

    /**
     * @param  array<int, int>  $userIds
     */
    public function __construct(
        public array $userIds,
        public int $conversationId,
        public int $userId,
        public string $userName,
        public string $kind = 'typing',
    ) {}

    public function broadcastAs(): string
    {
        return 'user.typing';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'user_id' => $this->userId,
            'user_name' => $this->userName,
            'kind' => $this->kind,
        ];
    }
}
