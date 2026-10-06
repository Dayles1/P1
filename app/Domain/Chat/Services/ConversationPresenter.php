<?php

namespace App\Domain\Chat\Services;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Models\MessageUserHide;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserBlock;
use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Per-viewer facts the chat list shows, worked out for a whole page of
 * conversations in a fixed number of queries: the other person in each
 * private chat (instead of loading every member of every chat), blocks,
 * unread mentions, whether my last message was read, and the last message
 * the viewer can actually see.
 */
class ConversationPresenter
{
    public function __construct(
        private readonly MessagePreview $preview,
        private readonly UserDateFormatter $formatter,
        private readonly ChatAccess $access,
    ) {}

    /**
     * The viewer's conversations, each with its pivot (loaded through
     * `$viewer->conversations()`).
     *
     * @param  Collection<int, covariant Conversation>  $conversations
     */
    public function prepare(Collection $conversations, User $viewer): void
    {
        if ($conversations->isEmpty()) {
            return;
        }

        $conversations->loadMissing(['lastMessage.user:id,name', 'lastMessage.attachments', 'avatarAttachment']);
        $conversations->loadCount('users');

        $ids = $conversations->pluck('id')->map(fn ($id): int => (int) $id)->all();
        $privateIds = $conversations->where('type', Conversation::TYPE_PRIVATE)->pluck('id')->all();

        $others = $privateIds === [] ? collect() : ConversationUser::query()
            ->whereIn('conversation_id', $privateIds)
            ->where('user_id', '!=', $viewer->id)
            ->with('user.avatar')
            ->orderBy('id')
            ->get()
            ->unique('conversation_id')
            ->keyBy('conversation_id');

        $iBlocked = UserBlock::query()->where('user_id', $viewer->id)->pluck('blocked_user_id')->map(fn ($id): int => (int) $id)->all();
        $blockedMe = UserBlock::query()->where('blocked_user_id', $viewer->id)->pluck('user_id')->map(fn ($id): int => (int) $id)->all();

        $othersMaxRead = ConversationUser::query()
            ->whereIn('conversation_id', $ids)
            ->where('user_id', '!=', $viewer->id)
            ->whereNull('left_at')
            ->groupBy('conversation_id')
            ->selectRaw('conversation_id, max(last_read_message_id) as max_read')
            ->pluck('max_read', 'conversation_id');

        $mentions = DB::table('messages')
            ->join('conversation_users as cu', function ($join) use ($viewer): void {
                $join->on('cu.conversation_id', '=', 'messages.conversation_id')->where('cu.user_id', '=', $viewer->id);
            })
            ->whereIn('messages.conversation_id', $ids)
            ->whereNull('messages.deleted_at')
            ->whereRaw('messages.id > coalesce(cu.last_read_message_id, 0)')
            ->whereRaw('messages.id > coalesce(cu.cleared_up_to_message_id, 0)')
            ->where('messages.user_id', '!=', $viewer->id)
            ->where('messages.body', 'like', '%]('.(int) $viewer->id.')%')
            ->groupBy('messages.conversation_id')
            ->selectRaw('messages.conversation_id, count(*) as aggregate')
            ->pluck('aggregate', 'conversation_id');

        $hiddenLastIds = MessageUserHide::query()
            ->where('user_id', $viewer->id)
            ->whereIn('message_id', $conversations->pluck('last_message_id')->filter()->values())
            ->pluck('message_id')
            ->map(fn ($id): int => (int) $id)
            ->all();

        foreach ($conversations as $conversation) {
            $other = $others->get($conversation->id)?->user;
            $pivot = $conversation->pivot;
            $lastMessage = $this->visibleLastMessage($conversation, $pivot, $viewer, $hiddenLastIds);

            $conversation->viewerContext = [
                'other_user' => $other,
                'blocked_by_me' => $other !== null && in_array((int) $other->id, $iBlocked, true),
                'blocked' => $other !== null && (in_array((int) $other->id, $iBlocked, true) || in_array((int) $other->id, $blockedMe, true)),
                'others_max_read' => (int) ($othersMaxRead[$conversation->id] ?? 0),
                'unread_mentions_count' => (int) ($mentions[$conversation->id] ?? 0),
                'last_message' => $lastMessage,
            ];
        }
    }

    /**
     * The chat-list line for a message. `$viewer` null: viewer-neutral
     * (broadcasts), so `is_read` is false.
     *
     * @return array<string, mixed>
     */
    public function lastMessage(Message $message, ?User $viewer, int $othersMaxRead = 0): array
    {
        return [
            'id' => $message->id,
            'type' => $message->type,
            'preview' => $this->preview->for($message),
            'body' => $message->body,
            'sender_id' => $message->user_id !== null ? (int) $message->user_id : null,
            'sender_name' => $message->user?->name,
            'sender' => $message->user?->name,
            'created_at_iso' => $this->formatter->iso($message->created_at, $viewer),
            'created_at' => $viewer ? $this->formatter->format($message->created_at, $viewer) : null,
            'attachment_kind' => $message->attachments->first()?->kind(),
            'is_read' => $othersMaxRead >= (int) $message->id,
        ];
    }

    /**
     * The member's own settings for a chat, as `conversation.settings` sends them.
     *
     * @return array{conversation_id: int, is_muted: bool, muted_until_iso: string|null, is_archived: bool, is_pinned: bool, marked_unread: bool, unread_count: int}
     */
    public function settings(ConversationUser $membership, ?User $viewer = null): array
    {
        return [
            'conversation_id' => (int) $membership->conversation_id,
            'is_muted' => $membership->isMuted(),
            'muted_until_iso' => $membership->muted_until && $membership->muted_until->isFuture()
                ? $this->formatter->iso($membership->muted_until, $viewer)
                : null,
            'is_archived' => $membership->archived_at !== null,
            'is_pinned' => (bool) $membership->is_pinned,
            'marked_unread' => (bool) $membership->marked_unread,
            'unread_count' => (int) $membership->unread_count,
        ];
    }

    /**
     * The viewer's conversation, as a list item needs it (with its pivot).
     */
    public function findForViewer(User $viewer, int $conversationId): Conversation
    {
        $this->access->membership($viewer, $conversationId);

        /** @var Conversation $conversation */
        $conversation = $viewer->conversations()->whereKey($conversationId)->firstOrFail();
        $this->prepare(new Collection([$conversation]), $viewer);

        return $conversation;
    }

    /**
     * @param  array<int, int>  $hiddenLastIds
     */
    private function visibleLastMessage(Conversation $conversation, ?ConversationUser $pivot, User $viewer, array $hiddenLastIds): ?Message
    {
        $last = $conversation->lastMessage;
        $clearedUpTo = (int) $pivot?->cleared_up_to_message_id;

        if (! $last || (int) $last->id <= $clearedUpTo) {
            return null;
        }

        if (! in_array((int) $last->id, $hiddenLastIds, true)) {
            return $last;
        }

        return Message::query()
            ->where('conversation_id', $conversation->id)
            ->where('id', '>', $clearedUpTo)
            ->whereNotExists(fn ($query) => $query->selectRaw('1')
                ->from('message_user_hides')
                ->whereColumn('message_user_hides.message_id', 'messages.id')
                ->where('message_user_hides.user_id', $viewer->id))
            ->with(['user:id,name', 'attachments'])
            ->orderByDesc('id')
            ->first();
    }
}
