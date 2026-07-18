<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Repositories\ConversationRepositoryInterface;
use App\Domain\Identity\Models\User;
use Illuminate\Validation\ValidationException;

class RemoveConversationMembers
{
    public function __construct(
        protected ConversationRepositoryInterface $repository
    ) {}

    public function handle(User $actor, Conversation $conversation, array $userIds): array
    {
        $actorPivot = ConversationUser::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $actor->id)
            ->first();

        if (! $actorPivot) {
            throw ValidationException::withMessages([
                'conversation' => __('messages.chat.not_a_member'),
            ]);
        }

        if ($conversation->type === 'private') {
            throw ValidationException::withMessages([
                'conversation' => __('messages.chat.cannot_remove_member_from_private_chat'),
            ]);
        }

        return $this->repository->removeMembers($conversation, $userIds);
    }
}