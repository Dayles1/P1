<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Events\ConversationActivity;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Repositories\ConversationRepositoryInterface;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\ConversationBroadcaster;
use App\Domain\Chat\Services\SystemMessages;
use App\Domain\Identity\Models\User;
use App\Domain\Notification\Services\ChatNotifier;
use App\Infrastructure\Broadcasting\LiveUpdates;

/**
 * Adds people to a group or channel — its creator and admins only.
 */
class AddConversationMembers
{
    public function __construct(
        protected ConversationRepositoryInterface $repository,
        protected ChatAccess $access,
        protected SystemMessages $systemMessages,
        protected ConversationBroadcaster $broadcaster,
        protected ChatNotifier $notifier,
    ) {}

    /**
     * @param  array<int, int>  $userIds
     * @return array{added: array<int, int>, restored: array<int, int>, skipped: array<int, int>}
     */
    public function handle(User $actor, Conversation $conversation, array $userIds): array
    {
        $membership = $this->access->membership($actor, $conversation->id);
        $this->access->ensureManager($membership);

        $result = $this->repository->addMembers($conversation, $userIds);

        $joinedIds = array_values(array_unique(array_map(
            'intval',
            [...$result['added'], ...$result['restored']],
        )));

        if ($joinedIds === []) {
            return $result;
        }

        $names = User::query()->whereKey($joinedIds)->pluck('name', 'id');

        $this->systemMessages->post($conversation, $actor, SystemMessages::MEMBERS_ADDED, [
            'user_ids' => $joinedIds,
            'names' => array_map(fn (int $id): string => (string) ($names[$id] ?? ''), $joinedIds),
        ]);

        LiveUpdates::toEveryone(new ConversationActivity(
            $joinedIds,
            $conversation->id,
            ConversationActivity::REASON_JOINED,
        ));

        $this->broadcaster->updated($conversation, 'members');
        $this->notifier->membersAdded($actor, $conversation, $joinedIds);

        return $result;
    }
}
