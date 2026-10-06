<?php

namespace App\Infrastructure\Persistence\Eloquent\Chat;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Repositories\ConversationRepositoryInterface;
use App\Domain\Identity\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class ConversationRepository implements ConversationRepositoryInterface
{
    public const DEFAULT_PER_PAGE = 50;

    /**
     * The member's chat list: pinned chats first (most recently pinned on
     * top), then by last activity — the last message, or when the chat was
     * created for one with no messages yet. Archived chats only appear in
     * the `archived` folder; private chats deleted "for me" not at all
     * (until a new message brings them back).
     *
     * @param  array{folder?: string|null, type?: string|null, search?: string|null, per_page?: int|null}  $filters
     * @return LengthAwarePaginator<int, Conversation&object{pivot: ConversationUser}>
     */
    public function getUserConversations(User $user, array $filters): LengthAwarePaginator
    {
        $query = $user->conversations()->where('conversation_users.is_hidden', false);
        $folder = $filters['folder'] ?? $filters['type'] ?? 'all';

        if ($folder === 'archived') {
            $query->whereNotNull('conversation_users.archived_at');
        } else {
            $query->whereNull('conversation_users.archived_at');
        }

        match ($folder) {
            'private' => $query->whereIn('conversations.type', [Conversation::TYPE_PRIVATE, Conversation::TYPE_SAVED]),
            'group' => $query->where('conversations.type', Conversation::TYPE_GROUP),
            'channel' => $query->where('conversations.type', Conversation::TYPE_CHANNEL),
            default => null,
        };

        if (! empty($filters['search'])) {
            $pattern = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], (string) $filters['search']).'%';

            // A private chat has no title of its own: it is found by the
            // name of the other person in it. A group is found by its title.
            $query->where(function ($q) use ($user, $pattern) {
                $q->where(function ($private) use ($user, $pattern) {
                    $private->where('conversations.type', Conversation::TYPE_PRIVATE)
                        ->whereExists(function ($other) use ($user, $pattern) {
                            $other->selectRaw('1')
                                ->from('conversation_users as other_member')
                                ->join('users as other_user', 'other_user.id', '=', 'other_member.user_id')
                                ->whereColumn('other_member.conversation_id', 'conversations.id')
                                ->where('other_member.user_id', '!=', $user->id)
                                ->whereRaw("other_user.name like ? escape '!'", [$pattern]);
                        });
                })->orWhere(function ($group) use ($pattern) {
                    $group->whereIn('conversations.type', [Conversation::TYPE_GROUP, Conversation::TYPE_CHANNEL])
                        ->whereRaw("conversations.title like ? escape '!'", [$pattern]);
                });
            });
        }

        return $query
            ->orderByDesc('conversation_users.is_pinned')
            ->orderByDesc('conversation_users.pinned_at')
            ->orderByRaw('COALESCE(conversations.last_message_at, conversations.created_at) DESC')
            ->orderByDesc('conversations.id')
            ->paginate(min(100, max(1, (int) ($filters['per_page'] ?? self::DEFAULT_PER_PAGE))));
    }

    /**
     * Adds people as ordinary members. Someone who left before is brought
     * back as a member (not with their old role). New members start with
     * everything up to now read. Two requests adding the same person at
     * once add them once (the second sees them as already there).
     *
     * @param  array<int, int>  $userIds
     * @return array{added: array<int, int>, restored: array<int, int>, skipped: array<int, int>}
     */
    public function addMembers(Conversation $conversation, array $userIds): array
    {
        $userIds = collect($userIds)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $added = [];
        $restored = [];
        $skipped = [];
        $now = now();
        $lastMessageId = Conversation::query()->whereKey($conversation->id)->value('last_message_id');

        foreach ($userIds as $userId) {
            $existing = ConversationUser::query()
                ->where('conversation_id', $conversation->id)
                ->where('user_id', $userId)
                ->first();

            if ($existing && $existing->left_at === null) {
                $skipped[] = $userId;

                continue;
            }

            if ($existing) {
                $updated = ConversationUser::query()
                    ->where('conversation_id', $conversation->id)
                    ->where('user_id', $userId)
                    ->whereNotNull('left_at')
                    ->update([
                        'left_at' => null,
                        'role' => ConversationUser::ROLE_MEMBER,
                        'is_hidden' => false,
                        'is_pinned' => false,
                        'pinned_at' => null,
                        'archived_at' => null,
                        'marked_unread' => false,
                        'unread_count' => 0,
                        'joined_at' => $now,
                        'last_read_message_id' => $lastMessageId,
                        'last_read_at' => $now,
                        'notifications_enabled' => true,
                        'muted_until' => null,
                    ]);

                if ($updated > 0) {
                    $restored[] = $userId;
                } else {
                    $skipped[] = $userId;
                }

                continue;
            }

            $inserted = DB::table('conversation_users')->insertOrIgnore([
                'conversation_id' => $conversation->id,
                'user_id' => $userId,
                'role' => ConversationUser::ROLE_MEMBER,
                'joined_at' => $now,
                'last_read_message_id' => $lastMessageId,
                'last_read_at' => $now,
                'is_hidden' => false,
                'is_pinned' => false,
                'notifications_enabled' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            if ($inserted > 0) {
                $added[] = $userId;
            } else {
                $skipped[] = $userId;
            }
        }

        return [
            'added' => $added,
            'restored' => $restored,
            'skipped' => $skipped,
        ];
    }

    /**
     * Marks these active members as having left. The creator is never
     * removed this way (ownership is transferred first).
     *
     * @param  array<int, int>  $userIds
     * @return array{removed: array<int, int>, skipped: array<int, int>}
     */
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
                $updated = ConversationUser::query()
                    ->where('conversation_id', $conversation->id)
                    ->where('user_id', $userId)
                    ->whereNull('left_at')
                    ->where('role', '!=', ConversationUser::ROLE_CREATOR)
                    ->update([
                        'left_at' => now(),
                        'is_hidden' => true,
                        'is_pinned' => false,
                        'pinned_at' => null,
                    ]);

                if ($updated > 0) {
                    $removed[] = $userId;
                } else {
                    $skipped[] = $userId;
                }
            }
        });

        return [
            'removed' => $removed,
            'skipped' => $skipped,
        ];
    }
}
