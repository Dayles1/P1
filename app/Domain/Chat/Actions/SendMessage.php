<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Identity\Models\User;
use Illuminate\Support\Facades\DB;

class SendMessage
{
    public function handle(User $user, int $conversationId, array $data): Message
    {
        $conversation = $user->conversations()->findOrFail($conversationId);

        return DB::transaction(function () use ($user, $conversation, $data) {
            $message = Message::create([
                'conversation_id' => $conversation->id,
                'user_id' => $user->id,
                'parent_message_id' => $data['parent_message_id'] ?? null,
                'type' => 'text',
                'body' => $data['body'],
            ]);

            $conversation->update([
                'last_message_id' => $message->id,
                'last_message_at' => $message->created_at,
            ]);

            ConversationUser::query()
                ->where('conversation_id', $conversation->id)
                ->where('user_id', '!=', $user->id)
                ->whereNull('left_at')
                ->increment('unread_count');

            ConversationUser::query()
                ->where('conversation_id', $conversation->id)
                ->where('user_id', $user->id)
                ->update([
                    'unread_count' => 0,
                    'last_read_message_id' => $message->id,
                    'last_read_at' => $message->created_at,
                ]);

            return $message->load('user.avatar');
        });
    }
}
