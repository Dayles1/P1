<?php

namespace App\Domain\Chat\Events;

use App\Domain\Chat\Events\Concerns\BroadcastsToMembers;
use App\Domain\Chat\Models\Message;
use App\Http\Resources\Chat\MessageResource;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class MessageSent implements ShouldBroadcastNow
{
    use BroadcastsToMembers, Dispatchable, InteractsWithSockets;

    /**
     * @param  array<int, int>  $userIds
     */
    public function __construct(
        public array $userIds,
        public Message $message,
    ) {}

    public function broadcastAs(): string
    {
        return 'message.sent';
    }

    /** @return array{conversation_id: int, message: array<string, mixed>} */
    public function broadcastWith(): array
    {
        return [
            'conversation_id' => (int) $this->message->conversation_id,
            'message' => MessageResource::forBroadcast($this->message),
        ];
    }
}
