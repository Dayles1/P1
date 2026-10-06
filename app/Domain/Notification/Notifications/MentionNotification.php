<?php

namespace App\Domain\Notification\Notifications;

use App\Domain\Identity\Models\User;

/** @mentions in chat — the one type that always persists, regardless of the recipient's preferences (see BaseNotification::via). */
class MentionNotification extends ChatNotification
{
    public function type(): string
    {
        return 'mention';
    }

    protected function body(User $notifiable): string
    {
        return $this->line($notifiable, 'mention', ['name' => $this->senderName, 'preview' => $this->preview]);
    }
}
