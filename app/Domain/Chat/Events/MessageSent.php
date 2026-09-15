<?php

namespace App\Domain\Chat\Events;

use App\Domain\Chat\Models\Message;
use App\Http\Resources\Chat\MessageResource;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Message $message,
    ) {}

    /** @return array<int, Channel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("conversation.{$this->message->conversation_id}")];
    }

    public function broadcastAs(): string
    {
        return 'message.sent';
    }

    public function broadcastWith(): array
    {
        // MessageResource reads `is_mine` off the requesting user via
        // request()->user(), which doesn't exist on a queued broadcast —
        // every recipient just sees is_mine: false, which the frontend
        // corrects itself by comparing sender.id against its own user id.
        return (new MessageResource($this->message))->resolve();
    }
}
