<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Identity\Models\User;
use Illuminate\Validation\ValidationException;

class PinConversation
{
    public function handle(User $user, Conversation $conversation): void
    {
        $pivot = ConversationUser::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ($pivot->is_pinned) {
            return;
        }

        $pinnedCount = ConversationUser::query()
            ->where('user_id', $user->id)
            ->where('is_pinned', true)
            ->count();

        if ($pinnedCount >= 10) {
            throw ValidationException::withMessages([
                'conversation' => __('messages.chat.max_pinned_reached'),
            ]);
        }

        $pivot->update([
            'is_pinned' => true,
        ]);
    }
}