<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Message;
use App\Domain\Identity\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;

class SearchMessages
{
    public function handle(User $user, string $query, ?int $conversationId = null, int $perPage = 20): LengthAwarePaginator
    {
        $conversationIds = $conversationId
            ? $user->conversations()->where('conversations.id', $conversationId)->pluck('conversations.id')
            : $user->conversations()->pluck('conversations.id');

        $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $query);

        return Message::query()
            ->whereIn('conversation_id', $conversationIds)
            ->where('body', 'like', "%{$escaped}%")
            ->with(['user.avatar', 'conversation'])
            ->latest('id')
            ->paginate($perPage);
    }
}
