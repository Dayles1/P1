<?php

namespace App\Domain\Chat\Queries;

use App\Domain\Chat\Repositories\ConversationRepositoryInterface;
use App\Domain\Identity\Models\User;

class GetConversationsQuery
{
    public function __construct(
        private ConversationRepositoryInterface $repository
    ) {}

    public function execute(User $user, array $filters)
    {
        return $this->repository
            ->getUserConversations(
                $user,
                $filters
            );
    }
}
