<?php

namespace App\Domain\Chat\Repositories;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Identity\Models\User;

interface ConversationRepositoryInterface
{
    public function getUserConversations(User $user,array $filters);
    
    public function addMembers(Conversation $conversation, array $userIds): array;

    public function removeMembers(Conversation $conversation, array $userIds): array;
}
