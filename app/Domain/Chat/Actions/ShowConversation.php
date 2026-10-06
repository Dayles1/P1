<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\MessageAttachment;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\ConversationPresenter;
use App\Domain\Identity\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * A conversation's details page: who created it and when, the viewer's
 * role, permissions and settings, and how much of each kind of content it
 * holds (counting only what the viewer can see).
 */
class ShowConversation
{
    public function __construct(
        private readonly ChatAccess $access,
        private readonly ConversationPresenter $presenter,
        private readonly ListMessages $listMessages,
    ) {}

    public function handle(User $user, int $conversationId): Conversation
    {
        $membership = $this->access->membership($user, $conversationId);

        /** @var Conversation $conversation */
        $conversation = $user->conversations()
            ->whereKey($conversationId)
            ->with(['creator.avatar', 'avatarAttachment'])
            ->firstOrFail();

        $this->presenter->prepare(new Collection([$conversation]), $user);

        $conversation->viewerContext = [
            ...($conversation->viewerContext ?? []),
            'stats' => $this->stats($membership),
            'can_post' => $this->access->canPost($membership),
        ];

        return $conversation;
    }

    /**
     * @return array{messages: int, media: int, files: int, voice: int, links: int}
     */
    private function stats(ConversationUser $membership): array
    {
        $visible = fn (): Builder => $this->listMessages->visible($membership);
        $attachments = fn (): Builder => MessageAttachment::query()
            ->whereIn('message_id', $visible()->select('id')->toBase());

        return [
            'messages' => $visible()->where('type', '!=', 'system')->count(),
            'media' => $attachments()->where(fn ($query) => $query->where('mime_type', 'like', 'image/%')->orWhere('mime_type', 'like', 'video/%'))->count(),
            'files' => $attachments()->where(fn ($query) => $query->whereNull('mime_type')
                ->orWhere(fn ($other) => $other->where('mime_type', 'not like', 'image/%')
                    ->where('mime_type', 'not like', 'video/%')
                    ->where('mime_type', 'not like', 'audio/%')))->count(),
            'voice' => $attachments()->where('mime_type', 'like', 'audio/%')->count(),
            'links' => $visible()->where(fn ($query) => $query->where('body', 'like', '%http://%')->orWhere('body', 'like', '%https://%'))->count(),
        ];
    }

    /**
     * @return array{can_edit_info: bool, can_add_members: bool, can_remove_members: bool, can_change_roles: bool, can_delete_conversation: bool, can_post: bool}
     */
    public static function permissions(Conversation $conversation, ?ConversationUser $membership, bool $canPost): array
    {
        $groupLike = $conversation->isGroupLike();
        $isManager = $groupLike && (bool) $membership?->isManager();
        $isCreator = $groupLike && $membership?->role === ConversationUser::ROLE_CREATOR;

        return [
            'can_edit_info' => $isManager,
            'can_add_members' => $isManager,
            'can_remove_members' => $isManager,
            'can_change_roles' => $isCreator,
            'can_delete_conversation' => $groupLike ? $isCreator : true,
            'can_post' => $canPost,
        ];
    }
}
