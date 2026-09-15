<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Identity\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class ListMessages
{
    /**
     * `before_id` (when present) turns this into "give me the next older
     * page below this id" — always requested/answered as page 1 of a query
     * already filtered to `id < before_id`, which is what makes it a real
     * cursor rather than an offset: a message arriving between two calls
     * can never shift where the "next page" starts, so nothing gets
     * skipped or duplicated the way page-number pagination would risk.
     */
    public function handle(User $user, int $conversationId, array $filters = []): LengthAwarePaginator
    {
        $conversation = $user->conversations()->findOrFail($conversationId);

        $query = $conversation->messages()
            ->with(['user.avatar', 'attachments', 'reactions', 'reads', 'parent.user']);

        $beforeId = $filters['before_id'] ?? null;

        if ($beforeId) {
            $query->where('id', '<', $beforeId);
        }

        $messages = $query->latest('id')->paginate($filters['per_page'] ?? 30);

        // Only the newest (no before_id) page reflects what the viewer is
        // actually looking at right now — marking read off an older,
        // scrolled-back-into page would move last_read_message_id
        // *backwards*, which would make the conversation look less-read
        // than it already was.
        if (! $beforeId) {
            $this->markRead($conversation->id, $user->id, $messages->first()?->id);
        }

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
