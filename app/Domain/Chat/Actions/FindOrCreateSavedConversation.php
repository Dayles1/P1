<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Identity\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * The member's "Saved Messages" (Избранное): a chat with only its owner
 * in it, created the first time it is asked for. Locking the owner's row
 * makes two simultaneous first requests create it once.
 */
class FindOrCreateSavedConversation
{
    public function handle(User $user): Conversation
    {
        return DB::transaction(function () use ($user): Conversation {
            User::query()->whereKey($user->id)->lockForUpdate()->first();

            $existing = Conversation::query()
                ->where('type', Conversation::TYPE_SAVED)
                ->where('created_by', $user->id)
                ->oldest('id')
                ->first();

            if ($existing) {
                ConversationUser::query()
                    ->where('conversation_id', $existing->id)
                    ->where('user_id', $user->id)
                    ->update(['left_at' => null, 'is_hidden' => false]);

                return $existing;
            }

            $conversation = Conversation::query()->create([
                'type' => Conversation::TYPE_SAVED,
                'title' => null,
                'created_by' => $user->id,
            ]);

            ConversationUser::query()->create([
                'conversation_id' => $conversation->id,
                'user_id' => $user->id,
                'role' => ConversationUser::ROLE_CREATOR,
                'joined_at' => now(),
            ]);

            return $conversation;
        });
    }
}
