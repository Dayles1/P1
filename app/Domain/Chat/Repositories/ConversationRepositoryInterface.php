<?php

namespace App\Domain\Chat\Repositories;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Identity\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;

interface ConversationRepositoryInterface
{
    /**
     * @param  array{folder?: string|null, type?: string|null, search?: string|null, per_page?: int|null}  $filters
     * @return LengthAwarePaginator<int, Conversation&object{pivot: ConversationUser}>
     */
    public function getUserConversations(User $user, array $filters): LengthAwarePaginator;

    /**
     * @param  array<int, int>  $userIds
     * @return array{added: array<int, int>, restored: array<int, int>, skipped: array<int, int>}
     */
    public function addMembers(Conversation $conversation, array $userIds): array;

    /**
     * @param  array<int, int>  $userIds
     * @return array{removed: array<int, int>, skipped: array<int, int>}
     */
    public function removeMembers(Conversation $conversation, array $userIds): array;
}
