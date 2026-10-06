<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Services\ConversationBroadcaster;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserBlock;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Blocking someone: neither of the two can write in their private chat
 * any more (`can_send` false, sending answers 403 `chat.blocked`). Both
 * hear about it live through `conversation.updated` (reason `blocked`).
 */
class BlockUser
{
    public function __construct(
        private readonly ConversationBroadcaster $broadcaster,
    ) {}

    public function block(User $user, User $target): void
    {
        if ((int) $user->id === (int) $target->id) {
            throw ValidationException::withMessages([
                'user' => __('messages.chat.cannot_block_self'),
            ]);
        }

        $inserted = DB::table('user_blocks')->insertOrIgnore([
            'user_id' => $user->id,
            'blocked_user_id' => $target->id,
            'created_at' => now(),
        ]);

        if ($inserted > 0) {
            $this->announce($user, $target);
        }
    }

    public function unblock(User $user, User $target): void
    {
        $deleted = UserBlock::query()
            ->where('user_id', $user->id)
            ->where('blocked_user_id', $target->id)
            ->delete();

        if ($deleted > 0) {
            $this->announce($user, $target);
        }
    }

    private function announce(User $user, User $target): void
    {
        $conversationId = ConversationUser::query()
            ->join('conversations', 'conversations.id', '=', 'conversation_users.conversation_id')
            ->where('conversations.type', Conversation::TYPE_PRIVATE)
            ->whereIn('conversation_users.user_id', [$user->id, $target->id])
            ->groupBy('conversation_users.conversation_id')
            ->havingRaw('count(distinct conversation_users.user_id) = 2')
            ->value('conversation_users.conversation_id');

        $conversation = $conversationId !== null ? Conversation::query()->whereKey($conversationId)->first() : null;

        if ($conversation) {
            $this->broadcaster->updated($conversation, 'blocked');
        }
    }
}
