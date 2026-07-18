<?php

namespace App\Infrastructure\Persistence\Eloquent\Chat;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Repositories\ConversationRepositoryInterface;
use App\Domain\Identity\Models\User;
use Illuminate\Support\Facades\DB;

class ConversationRepository implements ConversationRepositoryInterface
{
    public function getUserConversations(
        User $user,
        array $filters
    ) {
        $query = $user->conversations()
            ->with([
                'users:id,name',
                'users.avatar',
                'lastMessage.sender:id,name',
            ])
            ->withPivot([
                'unread_count',
                'last_read_message_id',
                'last_read_at',
                'is_pinned',
                'is_hidden',
                'notifications_enabled',
            ]);

        $type = $filters['type'] ?? 'all';

        if ($type !== 'all') {
            $query->where('type', $type);
        }

        if (!empty($filters['search'])) {
            $search = $filters['search'];

            if ($type === 'private') {
                $query->whereHas('users', function ($q) use ($user, $search) {
                    $q->where('users.id', '!=', $user->id)
                      ->where('users.name', 'like', "%{$search}%");
                });
            } else {
                $query->where('name', 'like', "%{$search}%");
            }
        }

        return $query
            ->orderByDesc('conversation_users.is_pinned')
            ->orderByRaw('COALESCE(conversation_users.unread_count, 0) DESC')
            ->orderByDesc('last_message_at')
            ->paginate(30);
    }
    public function addMembers(Conversation $conversation, array $userIds): array
    {
        $userIds = collect($userIds)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $added = [];
        $restored = [];
        $skipped = [];

        DB::transaction(function () use ($conversation, $userIds, &$added, &$restored, &$skipped) {
            $now = now();

            $activeIds = ConversationUser::query()
                ->where('conversation_id', $conversation->id)
                ->whereIn('user_id', $userIds)
                ->whereNull('left_at')
                ->pluck('user_id')
                ->all();

            $leftMembers = ConversationUser::query()
                ->where('conversation_id', $conversation->id)
                ->whereIn('user_id', $userIds)
                ->whereNotNull('left_at')
                ->get()
                ->keyBy('user_id');

            foreach ($userIds as $userId) {
                if (in_array($userId, $activeIds, true)) {
                    $skipped[] = $userId;
                    continue;
                }

                if ($leftMembers->has($userId)) {
                    $leftMembers[$userId]->update([
                        'left_at' => null,
                        'is_hidden' => false,
                        'joined_at' => $now,
                        'notifications_enabled' => true,
                    ]);

                    $restored[] = $userId;
                    continue;
                }

                ConversationUser::create([
                    'conversation_id'       => $conversation->id,
                    'user_id'               => $userId,
                    'role'                  => 'member',
                    'joined_at'             => $now,
                    'is_hidden'             => false,
                    'is_pinned'             => false,
                    'notifications_enabled' => true,
                ]);

                $added[] = $userId;
            }
        });

        return [
            'added'    => $added,
            'restored' => $restored,
            'skipped'  => $skipped,
        ];
    }

    public function removeMembers(Conversation $conversation, array $userIds): array
    {
        $userIds = collect($userIds)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $removed = [];
        $skipped = [];

        DB::transaction(function () use ($conversation, $userIds, &$removed, &$skipped) {
            foreach ($userIds as $userId) {
                $pivot = ConversationUser::query()
                    ->where('conversation_id', $conversation->id)
                    ->where('user_id', $userId)
                    ->first();

                if (! $pivot || $pivot->left_at) {
                    $skipped[] = $userId;
                    continue;
                }

                if ($pivot->role === 'creator') {
                    $skipped[] = $userId;
                    continue;
                }

                $pivot->update([
                    'left_at' => now(),
                    'is_hidden' => true,
                    'is_pinned' => false,
                ]);

                $removed[] = $userId;
            }

            $remaining = ConversationUser::query()
                ->where('conversation_id', $conversation->id)
                ->whereNull('left_at')
                ->count();

            if ($remaining === 0) {
                $conversation->delete();
            }
        });

        return [
            'removed' => $removed,
            'skipped' => $skipped,
        ];
    }
}