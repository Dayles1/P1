<?php

namespace App\Domain\Chat\Queries;

use App\Domain\Chat\Models\Conversation;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class GetConversationMembersQuery
{
    public function execute(Conversation $conversation): LengthAwarePaginator
    {
        return $conversation->users()
            ->with('avatar')
            ->withPivot([
                'role',
                'joined_at',
                'left_at',
                'muted_until',
                'last_read_message_id',
                'last_read_at',
                'is_pinned',
                'is_hidden',
                'notifications_enabled',
            ])
            ->paginate(30);
    }
}