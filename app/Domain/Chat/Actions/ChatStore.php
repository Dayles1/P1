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
                'user_id'         => $authId,
                'role'            => 'creator',
                'joined_at'       => $now,
            ]);

            $members = collect($data['user_ids'] ?? [])
                ->unique()
                ->reject(fn ($id) => $id == $authId)
                ->map(fn ($id) => [
                    'conversation_id' => $conversation->id,
                    'user_id'         => $id,
                    'role'            => 'member',
                    'joined_at'       => $now,
                ])
                ->values()
                ->all();

            if ($members !== []) {
                ConversationUser::insert($members);
            }

            return $conversation;
        });
    }
}