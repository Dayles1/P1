<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Identity\Models\User;

class ShowConversation
{
    public function handle(User $user, int $conversationId): Conversation
    {
        return $user->conversations()
            ->with([
                'lastMessage.user',
                'users.avatar',
                'avatar',
                'creator:id,name',
            ])
            ->withCount('users')
            ->withPivot([
                'unread_count',
                'last_read_message_id',
                'last_read_at',
            ])
            ->findOrFail($conversationId);
    }
}