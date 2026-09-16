<?php

namespace App\Domain\Notification\Notifications;

use App\Domain\Identity\Models\User;

/** @mentions in chat — the one type that always persists, regardless of the recipient's preferences (see BaseNotification::via). */
class MentionNotification extends BaseNotification
{
    public function __construct(
        protected int $conversationId,
        protected int $messageId,
        protected string $conversationTitle,
        protected string $senderName,
        protected string $preview,
    ) {}

    public function type(): string
    {
        return 'mention';
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(User $notifiable): array
    {
        return [
            'type' => $this->type(),
            'conversation_id' => $this->conversationId,
            'message_id' => $this->messageId,
            'title' => $this->conversationTitle,
            'body' => "{$this->senderName} mentioned you: {$this->preview}",
            'action_url' => "/chat/{$this->conversationId}",
        ];
    }
}
