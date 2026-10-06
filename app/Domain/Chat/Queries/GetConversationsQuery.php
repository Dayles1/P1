<?php

namespace App\Domain\Chat\Queries;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Repositories\ConversationRepositoryInterface;
use App\Domain\Chat\Services\ConversationPresenter;
use App\Domain\Identity\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Pagination\LengthAwarePaginator;

class GetConversationsQuery
{
    public function __construct(
        private ConversationRepositoryInterface $repository,
        private ConversationPresenter $presenter,
    ) {}

    /**
     * @param  array{folder?: string|null, type?: string|null, search?: string|null, per_page?: int|null}  $filters
     * @return LengthAwarePaginator<int, Conversation&object{pivot: ConversationUser}>
     */
    public function execute(User $user, array $filters): LengthAwarePaginator
    {
        $conversations = $this->repository->getUserConversations($user, $filters);

        $this->presenter->prepare(new Collection($conversations->items()), $user);

        return $conversations;
    }
}
