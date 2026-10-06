<?php

namespace App\Http\Resources\Chat;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Services\ConversationPresenter;
use App\Domain\Identity\Models\User;
use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One row of the chat list (SPEC 2.3), for the requesting member. Run the
 * page through ConversationPresenter::prepare() first — a row without it
 * prepares itself, at a few queries more.
 *
 * @mixin Conversation
 *
 * @property-read ConversationUser|null $pivot
 */
class ConversationListResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Conversation $conversation */
        $conversation = $this->resource;
        $viewer = $request->user();
        $presenter = app(ConversationPresenter::class);
        $formatter = app(UserDateFormatter::class);

        if ($conversation->viewerContext === null) {
            $presenter->prepare(new Collection([$conversation]), $viewer);
        }

        $context = $conversation->viewerContext ?? [];
        /** @var User|null $other */
        $other = $context['other_user'] ?? null;
        $pivot = $conversation->pivot;
        $isPrivate = $conversation->type === Conversation::TYPE_PRIVATE;
        $isManager = $pivot?->isManager() ?? false;
        $lastMessage = $context['last_message'] ?? null;

        return [
            'id' => $conversation->id,
            'type' => $conversation->type,
            'title' => $isPrivate ? $other?->name : $conversation->title,
            'description' => $conversation->description,
            'avatar' => $isPrivate ? $other?->avatar?->url : $conversation->avatarUrl(),
            'other_user' => $isPrivate && $other ? [
                'id' => $other->id,
                'name' => $other->name,
                'avatar' => $other->avatar?->url,
                'last_seen_at_iso' => $formatter->iso($other->last_seen_at, $viewer),
            ] : null,
            'other_user_id' => $isPrivate ? $other?->id : null,
            'is_saved' => $conversation->type === Conversation::TYPE_SAVED,
            'my_role' => $pivot->role ?? ConversationUser::ROLE_MEMBER,
            'members_count' => (int) ($conversation->users_count ?? 0),
            'is_pinned' => (bool) $pivot?->is_pinned,
            'pinned_at_iso' => $pivot?->is_pinned ? $formatter->iso($pivot->pinned_at, $viewer) : null,
            'is_muted' => (bool) $pivot?->isMuted(),
            'muted_until_iso' => $pivot?->muted_until?->isFuture() ? $formatter->iso($pivot->muted_until, $viewer) : null,
            'is_archived' => $pivot?->archived_at !== null,
            'marked_unread' => (bool) $pivot?->marked_unread,
            'unread_count' => (int) ($pivot?->unread_count ?? 0),
            'unread_mentions_count' => (int) ($context['unread_mentions_count'] ?? 0),
            'last_read_message_id' => $pivot?->last_read_message_id !== null ? (int) $pivot->last_read_message_id : null,
            'last_message' => $lastMessage
                ? $presenter->lastMessage($lastMessage, $viewer, (int) ($context['others_max_read'] ?? 0))
                : null,
            'last_message_at_iso' => $formatter->iso($conversation->last_message_at, $viewer),
            'last_message_at' => $formatter->format($conversation->last_message_at, $viewer),
            'created_at_iso' => $formatter->iso($conversation->created_at, $viewer),
            'is_blocked' => (bool) ($context['blocked_by_me'] ?? false),
            'can_send' => match ($conversation->type) {
                Conversation::TYPE_PRIVATE => ! ($context['blocked'] ?? false),
                Conversation::TYPE_CHANNEL => $isManager,
                default => true,
            },
        ];
    }
}
