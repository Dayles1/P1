<?php

namespace App\Domain\Notification\Notifications;

use App\Domain\Identity\Models\User;

class SystemNotification extends BaseNotification
{
    public function __construct(
        protected string $title,
        protected string $body,
        protected ?string $actionUrl = null,
    ) {}

    public function type(): string
    {
        return 'system';
    }

    /**
     * @return array<string, mixed>
     */
    public function toDatabase(User $notifiable): array
    {
        return [
            'type' => $this->type(),
            'title' => $this->title,
            'body' => $this->body,
            'action_url' => $this->actionUrl,
        ];
    }
}
