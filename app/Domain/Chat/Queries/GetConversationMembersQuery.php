<?php

namespace App\Domain\Chat\Queries;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Identity\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;

class GetConversationMembersQuery
{
    public function __construct(
        private readonly ChatAccess $access,
    ) {}

    /**
     * The current members, creator first, then admins, then everyone else,
     * each group by name. Only members may list them (404 otherwise), so
     * nobody can find out who is in a chat by guessing its id.
     *
     * @return LengthAwarePaginator<int, User&object{pivot: ConversationUser}>
     */
    public function execute(Conversation $conversation, User $actor, int $perPage = 50): LengthAwarePaginator
    {
        $this->access->membership($actor, $conversation->id);

        return $conversation->users()
            ->with('avatar')
            ->orderByRaw(
                'case conversation_users.role when ? then 0 when ? then 1 else 2 end',
                [ConversationUser::ROLE_CREATOR, ConversationUser::ROLE_ADMIN],
            )
            ->orderBy('users.name')
            ->orderBy('users.id')
            ->paginate($perPage);
    }
}
