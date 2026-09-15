<?php

namespace App\Domain\Notification\Notifications;

use App\Domain\Identity\Models\User;

/** Fired when a chat message arrives for a recipient who isn't actively viewing that conversation. */
class MessageNotification extends BaseNotification
{
    public function __construct(
        protected int $conversationId,
        protected string $conversationTitle,
        protected string $senderName,
        protected string $preview,
    ) {}

    public function type(): string
    {
        return 'message';
    }

    public function toDatabase(User $notifiable): array
    {
        return [
            'type' => $this->type(),
            'conversation_id' => $this->conversationId,
            'title' => $this->conversationTitle,
            'body' => "{$this->senderName}: {$this->preview}",
            'action_url' => "/chat/{$this->conversationId}",
        ];
    }
}
