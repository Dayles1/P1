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
    /**
     * "Read up to and including message X" — not just message X itself.
     * A client only ever calls this for the newest message it can see
     * (opening a conversation, scrolling to the bottom), so without this,
     * every earlier message in the same batch would never get its own
     * MessageRead row and would show as unread forever even though the
     * viewer plainly scrolled past it.
     */
    public function handle(User $user, int $conversationId, int $messageId): void
    {
        $message = Message::query()
            ->where('conversation_id', $conversationId)
            ->findOrFail($messageId);

        $newlyReadIds = DB::transaction(function () use ($user, $conversationId, $message) {
            $now = now();

            $alreadyRead = MessageRead::query()
                ->where('user_id', $user->id)
                ->whereIn('message_id', function ($query) use ($conversationId, $message) {
                    $query->select('id')->from('messages')
                        ->where('conversation_id', $conversationId)
                        ->where('id', '<=', $message->id);
                })
                ->pluck('message_id');

            $unreadIds = Message::query()
                ->where('conversation_id', $conversationId)
                ->where('id', '<=', $message->id)
                ->where('user_id', '!=', $user->id) // no self-read-receipts on your own messages
                ->whereNotIn('id', $alreadyRead)
                ->pluck('id');

            if ($unreadIds->isNotEmpty()) {
                MessageRead::insert($unreadIds->map(fn ($id) => [
                    'message_id' => $id,
                    'user_id' => $user->id,
                    'read_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ])->all());
            }

            $membership = ConversationUser::query()
                ->where('conversation_id', $conversationId)
                ->where('user_id', $user->id)
                ->first();

            if ($membership && (int) ($membership->last_read_message_id ?? 0) < $message->id) {
                $membership->update([
                    'last_read_message_id' => $message->id,
                    'last_read_at' => $now,
                    'unread_count' => 0,
                ]);
            }

            return $unreadIds;
        });

        if ($newlyReadIds->isNotEmpty()) {
            // One event carrying "read up to here" rather than one per
            // message — the frontend applies it to every local message id
            // <= this one instead of matching a single id.
            broadcast(new MessageReadEvent($conversationId, $message->id, $user->id))->toOthers();
        }
    }
}
