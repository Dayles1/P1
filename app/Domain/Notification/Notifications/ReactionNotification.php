<?php

namespace App\Domain\Notification\Notifications;

use App\Domain\Identity\Models\User;

/** Someone put a reaction on your message; `preview` is your message. */
class ReactionNotification extends ChatNotification
{
    /**
     * @param  array{id: int, name: string, avatar: string|null}|null  $actor
     */
    public function __construct(
        int $conversationId,
        int $messageId,
        string $conversationTitle,
        string $senderName,
        string $preview,
        protected string $emoji,
        ?array $actor = null,
        ?string $conversationType = null,
    ) {
        parent::__construct($conversationId, $messageId, $conversationTitle, $senderName, $preview, $actor, $conversationType);
    }

    public function type(): string
    {
        return 'reaction';
    }

    protected function body(User $notifiable): string
    {
        return $this->line($notifiable, 'reaction', [
            'name' => $this->senderName,
            'emoji' => $this->emoji,
            'preview' => $this->preview,
        ]);
    }

    /**
     * @return array{emoji: string}
     */
    protected function extra(): array
    {
        return ['emoji' => $this->emoji];
    }
}
