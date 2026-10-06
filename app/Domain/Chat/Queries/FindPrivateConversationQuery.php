<?php

namespace App\Domain\Chat\Queries;

use App\Domain\Chat\Models\Conversation;

class FindPrivateConversationQuery
{
    /**
     * The 1:1 conversation both users are still active members of, if any.
     * A "private" conversation is a DM — there is at most one per pair, so
     * starting a chat, and a profile's "message" button, reuse this one
     * rather than spawning a duplicate.
     */
    public function execute(int $userId, int $otherUserId): ?Conversation
    {
        if ($userId === $otherUserId) {
            return null;
        }

        return Conversation::query()
            ->where('type', 'private')
            ->whereHas('users', fn ($query) => $query->whereKey($userId))
            ->whereHas('users', fn ($query) => $query->whereKey($otherUserId))
            ->withCount('users')
            ->oldest('id')
            ->get()
            ->firstWhere('users_count', 2);
    }
}
