<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Message;
use App\Domain\Identity\Models\User;

class UnpinMessage
{
    public function handle(User $user, int $conversationId, int $messageId): Message
    {
        $user->conversations()->findOrFail($conversationId);

        $message = Message::query()
            ->where('conversation_id', $conversationId)
            ->findOrFail($messageId);

        $message->update(['is_pinned' => false, 'pinned_at' => null]);

        return $message;
    }
}
