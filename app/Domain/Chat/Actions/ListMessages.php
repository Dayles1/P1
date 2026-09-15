<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Identity\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class ListMessages
{
    public function handle(User $user, int $conversationId, array $filters = []): LengthAwarePaginator
    {
        $conversation = $user->conversations()->findOrFail($conversationId);

        $messages = $conversation->messages()
            ->with(['user.avatar', 'attachments', 'reactions', 'parent.user'])
            ->latest('id')
            ->paginate($filters['per_page'] ?? 30);

        $this->markRead($conversation->id, $user->id, $messages->first()?->id);

        return $messages;
    }

    private function markRead(int $conversationId, int $userId, ?int $lastMessageId): void
    {
        if (! $lastMessageId) {
            return;
        }

        DB::transaction(function () use ($conversationId, $userId, $lastMessageId) {
            ConversationUser::query()
                ->where('conversation_id', $conversationId)
                ->where('user_id', $userId)
                ->update([
                    'unread_count' => 0,
                    'last_read_message_id' => $lastMessageId,
                    'last_read_at' => now(),
                ]);
        });
    }
}
