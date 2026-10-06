<?php

namespace App\Domain\Chat\Services;

use App\Domain\Chat\Events\ConversationRemoved;
use App\Domain\Chat\Events\ConversationSettingsChanged;
use App\Domain\Chat\Events\ConversationUpdated;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Identity\Models\User;
use App\Infrastructure\Broadcasting\LiveUpdates;

/**
 * The conversation-level realtime events, addressed to the right people.
 */
class ConversationBroadcaster
{
    public function __construct(
        private readonly ChatAccess $access,
        private readonly ConversationPresenter $presenter,
    ) {}

    /**
     * Title, description, photo, members or roles changed — to every member.
     */
    public function updated(Conversation $conversation, string $reason): void
    {
        $conversation->refresh()->load('avatarAttachment');
        $memberIds = $this->access->memberIds($conversation->id);

        LiveUpdates::toOthers(new ConversationUpdated(
            $memberIds,
            $conversation->id,
            $conversation->title,
            $conversation->description,
            $conversation->avatarUrl(),
            count($memberIds),
            $reason,
        ));
    }

    /**
     * The member's own settings — to their other devices.
     */
    public function settings(User $user, int $conversationId): void
    {
        $membership = ConversationUser::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $user->id)
            ->first();

        if ($membership) {
            LiveUpdates::toOthers(new ConversationSettingsChanged([(int) $user->id], $this->presenter->settings($membership)));
        }
    }

    /**
     * @param  array<int, int>  $userIds
     */
    public function removed(array $userIds, int $conversationId, string $reason): void
    {
        LiveUpdates::toOthers(new ConversationRemoved(array_values(array_map('intval', $userIds)), $conversationId, $reason));
    }
}
