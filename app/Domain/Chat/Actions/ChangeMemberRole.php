<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\ConversationBroadcaster;
use App\Domain\Chat\Services\SystemMessages;
use App\Domain\Identity\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Roles in a group or channel: the creator makes members admins and back,
 * and can hand the group over to another member.
 */
class ChangeMemberRole
{
    public function __construct(
        private readonly ChatAccess $access,
        private readonly SystemMessages $systemMessages,
        private readonly ConversationBroadcaster $broadcaster,
    ) {}

    public function changeRole(User $actor, int $conversationId, int $userId, string $role): ConversationUser
    {
        $membership = $this->access->membership($actor, $conversationId);
        $this->access->ensureCreator($membership);
        $target = $this->target($conversationId, $userId);

        if ($target->role === ConversationUser::ROLE_CREATOR) {
            throw ValidationException::withMessages([
                'user' => __('messages.chat.cannot_change_creator_role'),
            ]);
        }

        if ($target->role !== $role) {
            $target->update(['role' => $role]);
            $this->broadcaster->updated($membership->conversation, 'roles');
        }

        return $target->refresh();
    }

    public function transferOwnership(User $actor, int $conversationId, int $userId): ConversationUser
    {
        $membership = $this->access->membership($actor, $conversationId);
        $this->access->ensureCreator($membership);

        if ($userId === (int) $actor->id) {
            throw ValidationException::withMessages([
                'user_id' => __('messages.chat.already_owner'),
            ]);
        }

        $target = $this->target($conversationId, $userId);

        DB::transaction(function () use ($membership, $target): void {
            $target->update(['role' => ConversationUser::ROLE_CREATOR]);
            $membership->update(['role' => ConversationUser::ROLE_ADMIN]);
        });

        $this->systemMessages->post($membership->conversation, $actor, SystemMessages::OWNERSHIP_TRANSFERRED, [
            'user_id' => $userId,
            'name' => (string) User::query()->whereKey($userId)->value('name'),
        ]);

        $this->broadcaster->updated($membership->conversation, 'roles');

        return $target->refresh();
    }

    private function target(int $conversationId, int $userId): ConversationUser
    {
        $target = ConversationUser::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $userId)
            ->whereNull('left_at')
            ->first();

        if (! $target) {
            throw (new ModelNotFoundException)->setModel(User::class, [$userId]);
        }

        return $target;
    }
}
