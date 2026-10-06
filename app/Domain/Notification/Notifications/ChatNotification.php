<?php

namespace App\Domain\Notification\Notifications;

use App\Domain\Identity\Models\User;

/**
 * Something that happened in a chat — the common payload every chat type
 * carries (which chat, which message, who did it and a plain-text preview),
 * so the bell, the notifications page and a toast can draw any of them
 * from `data` without parsing `body`.
 */
abstract class ChatNotification extends BaseNotification
{
    /**
     * @param  array{id: int, name: string, avatar: string|null}|null  $actor
     */
    public function __construct(
        protected int $conversationId,
        protected ?int $messageId,
        protected string $conversationTitle,
        protected string $senderName,
        protected string $preview,
        protected ?array $actor = null,
        protected ?string $conversationType = null,
    ) {}

    /** The one-line text stored in `data.body`, in the recipient's language. */
    abstract protected function body(User $notifiable): string;

    /**
     * Fields a type adds to the common payload.
     *
     * @return array<string, mixed>
     */
    protected function extra(): array
    {
        return [];
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
            'conversation_type' => $this->conversationType,
            'title' => $this->conversationTitle,
            'body' => $this->body($notifiable),
            'action_url' => "/chat/{$this->conversationId}",
            'sender_name' => $this->senderName,
            'preview' => $this->preview,
            'actor' => $this->actor,
            ...$this->extra(),
        ];
    }

    /**
     * A dictionary line in the recipient's language.
     *
     * @param  array<string, string>  $replace
     */
    protected function line(User $notifiable, string $key, array $replace = []): string
    {
        return (string) __("ui.notifications.server.{$key}", $replace, $this->localeFor($notifiable));
    }
}
