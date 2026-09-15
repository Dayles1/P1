<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Events\MessageDeleted;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Identity\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

class DeleteMessage
{
    public function handle(User $user, int $conversationId, int $messageId): void
    {
        $membership = ConversationUser::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->firstOrFail();

        $message = Message::query()
            ->where('conversation_id', $conversationId)
            ->findOrFail($messageId);

        if (! ChatPermissions::canModify($membership, $message, 'delete_message')) {
            throw new AuthorizationException(__('messages.chat.cannot_delete'));
        }

        $message->delete();

        broadcast(new MessageDeleted($conversationId, $messageId))->toOthers();
    }
}
