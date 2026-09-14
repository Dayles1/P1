<?php

namespace App\Domain\Chat\Queries;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Identity\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Validation\ValidationException;

class GetConversationMembersQuery
{
    /**
     * The route only binds the conversation by id (`Route::get('{conversation}/members', ...)`),
     * so without this check any authenticated user could list who's in ANY
     * conversation — including a private DM they're not part of — just by
     * guessing/incrementing the id.
     */
    public function execute(Conversation $conversation, User $actor): LengthAwarePaginator
    {
        $isMember = $conversation->participants()
            ->where('user_id', $actor->id)
            ->whereNull('left_at')
            ->exists();

        if (! $isMember) {
            throw ValidationException::withMessages([
                'conversation' => __('messages.chat.not_a_member'),
            ]);
        }

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
