<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\MessageHydrator;
use App\Domain\Identity\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * A window of a conversation's history, oldest first: the newest messages
 * (`from=end`, the default), the oldest (`from=start`), the ones before or
 * after an id (scrolling), or the ones around an id (jumping to a reply, a
 * pin or a search hit). Ids are the cursor, so a message arriving between
 * two calls never shifts a page.
 *
 * Reading is a separate call (POST …/read): listing has no side effects,
 * so a prefetch or a background tab never marks a chat read.
 */
class ListMessages
{
    public const DEFAULT_LIMIT = 30;

    public function __construct(
        private readonly ChatAccess $access,
        private readonly MessageHydrator $hydrator,
    ) {}

    /**
     * @param  array{limit?: int|null, before_id?: int|null, after_id?: int|null, around_id?: int|null, from?: string|null}  $filters
     * @return array{messages: Collection<int, Message>, meta: array{has_more_before: bool, has_more_after: bool, first_unread_id: int|null, last_read_message_id: int|null, unread_count: int}}
     */
    public function handle(User $user, int $conversationId, array $filters = []): array
    {
        $membership = $this->access->membership($user, $conversationId);
        $limit = (int) ($filters['limit'] ?? self::DEFAULT_LIMIT);

        if (! empty($filters['around_id'])) {
            $anchor = (int) $filters['around_id'];
            $older = intdiv($limit, 2);

            $messages = $this->visible($membership)->where('id', '<', $anchor)->orderByDesc('id')->limit($older)->get()
                ->merge($this->visible($membership)->where('id', '>=', $anchor)->orderBy('id')->limit($limit - $older)->get());
        } elseif (! empty($filters['before_id'])) {
            $messages = $this->visible($membership)->where('id', '<', (int) $filters['before_id'])->orderByDesc('id')->limit($limit)->get();
        } elseif (! empty($filters['after_id'])) {
            $messages = $this->visible($membership)->where('id', '>', (int) $filters['after_id'])->orderBy('id')->limit($limit)->get();
        } elseif (($filters['from'] ?? 'end') === 'start') {
            $messages = $this->visible($membership)->orderBy('id')->limit($limit)->get();
        } else {
            $messages = $this->visible($membership)->orderByDesc('id')->limit($limit)->get();
        }

        /** @var Collection<int, Message> $messages */
        $messages = $messages->sortBy('id')->values();
        $this->hydrator->hydrate($messages);

        return [
            'messages' => $messages,
            'meta' => [
                ...$this->edges($membership, $messages, $filters),
                'first_unread_id' => $this->firstUnreadId($membership, $user),
                'last_read_message_id' => $membership->last_read_message_id !== null ? (int) $membership->last_read_message_id : null,
                'unread_count' => (int) $membership->unread_count,
            ],
        ];
    }

    /**
     * What this member can see: not deleted, not deleted for them, not
     * before the point they cleared the history at.
     *
     * @return Builder<Message>
     */
    public function visible(ConversationUser $membership): Builder
    {
        return Message::query()
            ->where('conversation_id', $membership->conversation_id)
            ->when($membership->cleared_up_to_message_id, fn (Builder $query, $clearedUpTo) => $query->where('id', '>', (int) $clearedUpTo))
            ->whereNotExists(fn ($query) => $query->selectRaw('1')
                ->from('message_user_hides')
                ->whereColumn('message_user_hides.message_id', 'messages.id')
                ->where('message_user_hides.user_id', $membership->user_id));
    }

    /**
     * @param  Collection<int, Message>  $messages
     * @param  array<string, mixed>  $filters
     * @return array{has_more_before: bool, has_more_after: bool}
     */
    private function edges(ConversationUser $membership, Collection $messages, array $filters): array
    {
        if ($messages->isEmpty()) {
            return [
                'has_more_before' => ! empty($filters['after_id'])
                    && $this->visible($membership)->where('id', '<=', (int) $filters['after_id'])->exists(),
                'has_more_after' => ! empty($filters['before_id'])
                    && $this->visible($membership)->where('id', '>=', (int) $filters['before_id'])->exists(),
            ];
        }

        return [
            'has_more_before' => $this->visible($membership)->where('id', '<', (int) $messages->first()->id)->exists(),
            'has_more_after' => $this->visible($membership)->where('id', '>', (int) $messages->last()->id)->exists(),
        ];
    }

    private function firstUnreadId(ConversationUser $membership, User $user): ?int
    {
        $id = $this->visible($membership)
            ->where('id', '>', (int) $membership->last_read_message_id)
            ->where('type', '!=', Message::TYPE_SYSTEM)
            ->where(fn ($query) => $query->whereNull('user_id')->orWhere('user_id', '!=', $user->id))
            ->min('id');

        return $id !== null ? (int) $id : null;
    }
}
