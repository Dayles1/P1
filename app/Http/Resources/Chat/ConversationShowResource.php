<?php

namespace App\Http\Resources\Chat;

use App\Domain\Chat\Actions\ShowConversation;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Services\ConversationPresenter;
use App\Domain\Identity\Models\User;
use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A conversation's details (SPEC 2.3 `GET /api/conversations/{c}`), for
 * the requesting member. `stats` are only filled by ShowConversation.
 *
 * @mixin Conversation
 */
class ConversationShowResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Conversation $conversation */
        $conversation = $this->resource;
        $viewer = $request->user();
        $formatter = app(UserDateFormatter::class);
        $context = $conversation->viewerContext ?? [];

        $membership = $conversation->pivot instanceof ConversationUser
            ? $conversation->pivot
            : ConversationUser::query()
                ->where('conversation_id', $conversation->id)
                ->where('user_id', $viewer?->id)
                ->whereNull('left_at')
                ->first();

        /** @var User|null $other */
        $other = $context['other_user'] ?? null;
        $isPrivate = $conversation->type === Conversation::TYPE_PRIVATE;
        $membersCount = $conversation->users_count ?? $conversation->users()->count();
        $canPost = $context['can_post'] ?? true;

        return [
            'id' => $conversation->id,
            'type' => $conversation->type,
            'title' => $isPrivate ? $other?->name : $conversation->title,
            'description' => $conversation->description,
            'avatar' => $isPrivate ? $other?->avatar?->url : $conversation->avatarUrl(),
            'is_saved' => $conversation->type === Conversation::TYPE_SAVED,
            'other_user_id' => $isPrivate ? $other?->id : null,
            'created_by' => $conversation->created_by,
            'creator' => $conversation->creator ? [
                'id' => $conversation->creator->id,
                'name' => $conversation->creator->name,
                'avatar' => $conversation->creator->avatar?->url,
            ] : null,
            'created_at_iso' => $formatter->iso($conversation->created_at, $viewer),
            'created_at' => $formatter->format($conversation->created_at, $viewer),
            'members_count' => (int) $membersCount,
            'my_role' => $membership?->role,
            'permissions' => ShowConversation::permissions($conversation, $membership, (bool) $canPost),
            'settings' => $membership ? collect(app(ConversationPresenter::class)->settings($membership, $viewer))
                ->only(['is_muted', 'muted_until_iso', 'is_archived', 'is_pinned', 'marked_unread'])
                ->all() : null,
            'stats' => $context['stats'] ?? null,
        ];
    }
}
