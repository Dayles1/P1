<?php

namespace App\Domain\Identity\Services;

use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Models\MessageAttachment;
use App\Domain\Identity\Models\User;
use Illuminate\Contracts\Database\Query\Builder as QueryBuilder;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Facades\DB;

/**
 * What two people share: the conversations both of them are current
 * members of (their private chat and the common groups), and the
 * messages and attachments in those conversations the viewer can still
 * see — nothing deleted, hidden "for me", or cleared from their history.
 * The only way the profile reads chat content, so a viewer never learns
 * anything from a conversation they are not in.
 */
class SharedWithUser
{
    public const KIND_MEDIA = 'media';

    public const KIND_FILES = 'files';

    public const KIND_VOICE = 'voice';

    public const KIND_LINKS = 'links';

    /**
     * Ids of the conversations both users are current members of.
     *
     * @return array<int, int>
     */
    public function conversationIds(User $viewer, User $user): array
    {
        return DB::table('conversation_users as viewer_membership')
            ->join('conversation_users as user_membership', function (JoinClause $join) use ($user): void {
                $join->on('user_membership.conversation_id', '=', 'viewer_membership.conversation_id')
                    ->where('user_membership.user_id', $user->id)
                    ->whereNull('user_membership.left_at');
            })
            ->where('viewer_membership.user_id', $viewer->id)
            ->whereNull('viewer_membership.left_at')
            ->distinct()
            ->pluck('viewer_membership.conversation_id')
            ->map(fn ($id): int => (int) $id)
            ->all();
    }

    /**
     * Messages in the shared conversations that the viewer can see.
     *
     * @return Builder<Message>
     */
    public function messages(User $viewer, User $user): Builder
    {
        return Message::query()
            ->select('messages.*')
            ->join('conversation_users as viewer_membership', function (JoinClause $join) use ($viewer): void {
                $join->on('viewer_membership.conversation_id', '=', 'messages.conversation_id')
                    ->where('viewer_membership.user_id', $viewer->id)
                    ->whereNull('viewer_membership.left_at');
            })
            ->join('conversation_users as user_membership', function (JoinClause $join) use ($user): void {
                $join->on('user_membership.conversation_id', '=', 'messages.conversation_id')
                    ->where('user_membership.user_id', $user->id)
                    ->whereNull('user_membership.left_at');
            })
            ->whereRaw('messages.id > COALESCE(viewer_membership.cleared_up_to_message_id, 0)')
            ->whereNotExists(fn (QueryBuilder $query) => $query
                ->selectRaw('1')
                ->from('message_user_hides')
                ->whereColumn('message_user_hides.message_id', 'messages.id')
                ->where('message_user_hides.user_id', $viewer->id));
    }

    /**
     * Attachments of one kind in the shared conversations, newest first.
     *
     * @return Builder<MessageAttachment>
     */
    public function attachments(User $viewer, User $user, string $kind): Builder
    {
        $messageIds = $this->messages($viewer, $user)->select('messages.id');

        $query = MessageAttachment::query()
            ->whereIn('message_id', $messageIds)
            ->orderByDesc('id');

        return match ($kind) {
            self::KIND_MEDIA => $query->where(fn (Builder $where) => $where
                ->where('mime_type', 'like', 'image/%')
                ->orWhere('mime_type', 'like', 'video/%')),
            self::KIND_VOICE => $query->where('mime_type', 'like', 'audio/%'),
            default => $query->where(fn (Builder $where) => $where
                ->whereNull('mime_type')
                ->orWhere(fn (Builder $not) => $not
                    ->where('mime_type', 'not like', 'image/%')
                    ->where('mime_type', 'not like', 'video/%')
                    ->where('mime_type', 'not like', 'audio/%'))),
        };
    }

    /**
     * Messages with a link in them in the shared conversations, newest first.
     *
     * @return Builder<Message>
     */
    public function links(User $viewer, User $user): Builder
    {
        return $this->messages($viewer, $user)
            ->where(fn (Builder $where) => $where
                ->where('messages.body', 'like', '%http://%')
                ->orWhere('messages.body', 'like', '%https://%'))
            ->orderByDesc('messages.id');
    }
}
