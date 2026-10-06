<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Events\ConversationRemoved;
use App\Domain\Chat\Exceptions\ChatForbidden;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Repositories\ConversationRepositoryInterface;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\ConversationBroadcaster;
use App\Domain\Chat\Services\SystemMessages;
use App\Domain\Identity\Models\User;

/**
 * Removes members from a group or channel. The creator may remove anyone
 * but themselves; admins may remove ordinary members only. Removing
 * yourself is leaving.
 */
class RemoveConversationMembers
{
    public function __construct(
        protected ConversationRepositoryInterface $repository,
        protected ChatAccess $access,
        protected SystemMessages $systemMessages,
        protected ConversationBroadcaster $broadcaster,
        protected LeaveConversation $leaveConversation,
    ) {}

    /**
     * @param  array<int, int>  $userIds
     * @return array{removed: array<int, int>, skipped: array<int, int>}
     */
    public function handle(User $actor, Conversation $conversation, array $userIds): array
    {
        $userIds = array_values(array_unique(array_map('intval', $userIds)));

        if ($userIds === [(int) $actor->id]) {
            $this->leaveConversation->handle($actor, $conversation->id);

            return ['removed' => [(int) $actor->id], 'skipped' => []];
        }

        $membership = $this->access->membership($actor, $conversation->id);
        $this->access->ensureManager($membership);

        $targets = ConversationUser::query()
            ->where('conversation_id', $conversation->id)
            ->whereIn('user_id', $userIds)
            ->whereNull('left_at')
            ->get()
            ->keyBy('user_id');

        foreach ($targets as $target) {
            $allowed = (int) $target->user_id !== (int) $actor->id && match ($membership->role) {
                ConversationUser::ROLE_CREATOR => true,
                ConversationUser::ROLE_ADMIN => $target->role === ConversationUser::ROLE_MEMBER,
                default => false,
            };

            if (! $allowed) {
                throw ChatForbidden::because('chat.cannot_remove_member');
            }
        }

        $result = $this->repository->removeMembers($conversation, $targets->keys()->map(fn ($id): int => (int) $id)->all());
        $result['skipped'] = array_values(array_unique([...$result['skipped'], ...array_diff($userIds, $result['removed'])]));

        if ($result['removed'] === []) {
            return $result;
        }

        $this->broadcaster->removed($result['removed'], $conversation->id, ConversationRemoved::REASON_REMOVED);

        $names = User::query()->whereKey($result['removed'])->pluck('name', 'id');

        foreach ($result['removed'] as $removedId) {
            $this->systemMessages->post($conversation, $actor, SystemMessages::MEMBER_REMOVED, [
                'user_id' => $removedId,
                'name' => (string) ($names[$removedId] ?? ''),
            ]);
        }

        $this->broadcaster->updated($conversation, 'members');

        return $result;
    }
}
