<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Events\MessageRead as MessageReadEvent;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Models\MessageRead;
use App\Domain\Identity\Models\User;
use Illuminate\Support\Facades\DB;

class MarkMessageRead
{
    public function handle(User $user, int $conversationId, int $messageId): void
    {
        $message = Message::query()
            ->where('conversation_id', $conversationId)
            ->findOrFail($messageId);

        $created = DB::transaction(function () use ($user, $conversationId, $message) {
            $read = MessageRead::query()->firstOrCreate(
                ['message_id' => $message->id, 'user_id' => $user->id],
                ['read_at' => now()],
            );

            $membership = ConversationUser::query()
                ->where('conversation_id', $conversationId)
                ->where('user_id', $user->id)
                ->first();

            if ($membership && (int) ($membership->last_read_message_id ?? 0) < $message->id) {
                $membership->update([
                    'last_read_message_id' => $message->id,
                    'last_read_at' => now(),
                    'unread_count' => 0,
                ]);
            }

            return $read->wasRecentlyCreated;
        });

        if ($created) {
            broadcast(new MessageReadEvent($conversationId, $message->id, $user->id))->toOthers();
        }
    }
}
