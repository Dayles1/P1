<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Identity\Models\User;

class UnpinConversation
{
    public function handle(User $user, Conversation $conversation): void
    {
        ConversationUser::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->update([
                'is_pinned' => false,
            ]);
    }
}