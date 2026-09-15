<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Message;
use App\Domain\Identity\Models\User;

class PinMessage
{
    public function handle(User $user, int $conversationId, int $messageId): Message
    {
        // Any current member may pin/unpin — same as Telegram/Slack, no ownership restriction.
        $user->conversations()->findOrFail($conversationId);

        $message = Message::query()
            ->where('conversation_id', $conversationId)
            ->findOrFail($messageId);

        $message->update(['is_pinned' => true, 'pinned_at' => now()]);

        return $message;
    }
}
