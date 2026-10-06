<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\ConversationBroadcaster;
use App\Domain\Chat\Services\SystemMessages;
use App\Domain\Identity\Models\User;

/**
 * Renames a group or channel and/or changes its description — creator and
 * admins only. Each change leaves a service line in the chat.
 */
class UpdateConversation
{
    public function __construct(
        private readonly ChatAccess $access,
        private readonly SystemMessages $systemMessages,
        private readonly ConversationBroadcaster $broadcaster,
    ) {}

    /**
     * @param  array{title?: string|null, description?: string|null}  $data
     */
    public function handle(User $user, int $conversationId, array $data): Conversation
    {
        $membership = $this->access->membership($user, $conversationId);
        $this->access->ensureManager($membership);
        $conversation = $membership->conversation;

        $changes = [];

        if (array_key_exists('title', $data) && $data['title'] !== null && $data['title'] !== $conversation->title) {
            $changes['title'] = $data['title'];
        }

        if (array_key_exists('description', $data) && ($data['description'] ?: null) !== $conversation->description) {
            $changes['description'] = $data['description'] ?: null;
        }

        if ($changes === []) {
            return $conversation;
        }

        $conversation->update($changes);

        if (array_key_exists('title', $changes)) {
            $this->systemMessages->post($conversation, $user, SystemMessages::TITLE_CHANGED, ['title' => $changes['title']]);
        }

        if (array_key_exists('description', $changes)) {
            $this->systemMessages->post($conversation, $user, SystemMessages::DESCRIPTION_CHANGED, ['description' => (string) $changes['description']]);
        }

        $this->broadcaster->updated($conversation, 'info');

        return $conversation;
    }
}
