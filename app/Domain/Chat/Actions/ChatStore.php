<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ChatStore
{
    public function handle(array $data): Conversation
    {
        if ($data['type'] === 'private') {
            $existing = $this->findExistingPrivateConversation(Auth::id(), (int) $data['user_ids'][0]);

            if ($existing) {
                return $existing;
            }
        }

        return DB::transaction(function () use ($data) {
            $conversation = Conversation::create([
                'type' => $data['type'],
                'title' => $data['title'] ?? null,
                'created_by' => Auth::id(),
            ]);

            $authId = Auth::id();
            $now = now();

            ConversationUser::create([
                'conversation_id' => $conversation->id,
                'user_id' => $authId,
                'role' => 'creator',
                'joined_at' => $now,
            ]);

            $members = collect($data['user_ids'] ?? [])
                ->unique()
                ->reject(fn ($id) => $id == $authId)
                ->map(fn ($id) => [
                    'conversation_id' => $conversation->id,
                    'user_id' => $id,
                    'role' => 'member',
                    'joined_at' => $now,
                ])
                ->values()
                ->all();

            if ($members !== []) {
                ConversationUser::insert($members);
            }

            return $conversation;
        });
    }

    /**
     * A "private" conversation is a 1:1 DM — reuse the existing one between
     * these two users instead of spawning a duplicate every time either
     * side clicks "message" on the other's profile.
     */
    private function findExistingPrivateConversation(int $userId, int $otherUserId): ?Conversation
    {
        return Conversation::query()
            ->where('type', 'private')
            ->whereHas('users', fn ($query) => $query->whereKey($userId))
            ->whereHas('users', fn ($query) => $query->whereKey($otherUserId))
            ->withCount('users')
            ->get()
            ->firstWhere('users_count', 2);
    }
}
