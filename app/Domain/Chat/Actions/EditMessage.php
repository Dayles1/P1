<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Events\MessageEdited;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Identity\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

class EditMessage
{
    public function handle(User $user, int $conversationId, int $messageId, string $body): Message
    {
        $membership = ConversationUser::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->firstOrFail();

        $message = Message::query()
            ->where('conversation_id', $conversationId)
            ->findOrFail($messageId);

        if (! ChatPermissions::canModify($membership, $message, 'edit_message')) {
            throw new AuthorizationException(__('messages.chat.cannot_edit'));
        }

        $message->update([
            'body' => $body,
            'edited_at' => now(),
        ]);

        $message = $message->fresh(['user.avatar', 'attachments', 'reactions', 'parent.user']);

        broadcast(new MessageEdited($message))->toOthers();

        return $message;
    }
}
