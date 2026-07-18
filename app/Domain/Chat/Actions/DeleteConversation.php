<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DeleteConversation
{
    public function handle(User $user, Conversation $conversation): void
    {
        DB::transaction(function () use ($user, $conversation) {
            $pivot = ConversationUser::query()
                ->where('conversation_id', $conversation->id)
                ->where('user_id', $user->id)
                ->first();

            if (! $pivot) {
                throw ValidationException::withMessages([
                    'conversation' => __('messages.chat.not_a_member'),
                ]);
            }

            ConversationUser::query()
                ->where('conversation_id', $conversation->id)
                ->where('user_id', $user->id)
                ->update([
                    'left_at' => now(),
                    'is_hidden' => true,
                    'is_pinned' => false,
                ]);

            $remaining = ConversationUser::query()
                ->where('conversation_id', $conversation->id)
                ->whereNull('left_at')
                ->count();

            if ($remaining === 0) {
                $conversation->delete();
            }
        });
    }
}