<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Repositories\ConversationRepositoryInterface;
use App\Domain\Identity\Models\User;
use Illuminate\Validation\ValidationException;

class AddConversationMembers
{
    public function __construct(
        protected ConversationRepositoryInterface $repository
    ) {}

    public function handle(User $actor, Conversation $conversation, array $userIds): array
    {
        $this->ensureCanManage($actor, $conversation);

        if (! in_array($conversation->type, ['group', 'channel'], true)) {
            throw ValidationException::withMessages([
                'conversation' => __('messages.chat.cannot_add_member_to_private_chat'),
            ]);
        }

        return $this->repository->addMembers($conversation, $userIds);
    }

    protected function ensureCanManage(User $actor, Conversation $conversation): void
    {
        $pivot = ConversationUser::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $actor->id)
            ->first();

        if (! $pivot) {
            throw ValidationException::withMessages([
                'conversation' => __('messages.chat.not_a_member'),
            ]);
        }

        if ($pivot->role !== 'creator') {
            throw ValidationException::withMessages([
                'conversation' => __('messages.chat.not_allowed'),
            ]);
        }
    }
}