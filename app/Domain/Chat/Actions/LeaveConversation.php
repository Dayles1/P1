<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Events\ConversationRemoved;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\ConversationBroadcaster;
use App\Domain\Chat\Services\SystemMessages;
use App\Domain\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Leaves a group or channel. When the creator leaves, ownership passes to
 * the earliest-joined admin, else to the earliest-joined member; when
 * nobody is left, the conversation is deleted.
 */
class LeaveConversation
{
    public function __construct(
        private readonly ChatAccess $access,
        private readonly SystemMessages $systemMessages,
        private readonly ConversationBroadcaster $broadcaster,
    ) {}

    public function handle(User $user, int $conversationId): void
    {
        $membership = $this->access->membership($user, $conversationId);
        $conversation = $membership->conversation;

        if (! $this->access->isGroupLike($conversation)) {
            throw ValidationException::withMessages([
                'conversation' => __('messages.chat.cannot_leave_private_chat'),
            ]);
        }

        $remaining = DB::transaction(function () use ($user, $conversationId, $membership): int {
            ConversationUser::query()
                ->where('conversation_id', $conversationId)
                ->where('user_id', $user->id)
                ->update([
                    'left_at' => now(),
                    'is_hidden' => true,
                    'is_pinned' => false,
                    'pinned_at' => null,
                    'role' => ConversationUser::ROLE_MEMBER,
                ]);

            if ($membership->role === ConversationUser::ROLE_CREATOR) {
                $heir = ConversationUser::query()
                    ->where('conversation_id', $conversationId)
                    ->whereNull('left_at')
                    ->orderByRaw('case when role = ? then 0 else 1 end', [ConversationUser::ROLE_ADMIN])
                    ->orderBy('joined_at')
                    ->orderBy('id')
                    ->first();

                $heir?->update(['role' => ConversationUser::ROLE_CREATOR]);
            }

            return ConversationUser::query()
                ->where('conversation_id', $conversationId)
                ->whereNull('left_at')
                ->count();
        });

        $this->broadcaster->removed([(int) $user->id], $conversationId, ConversationRemoved::REASON_LEFT);

        if ($remaining === 0) {
            app(DeleteConversation::class)->purge($conversation);

            return;
        }

        $this->systemMessages->post($conversation, $user, SystemMessages::MEMBER_LEFT);
        $this->broadcaster->updated($conversation, 'members');
    }
}
