<?php

namespace App\Domain\Notification\Notifications;

use App\Domain\Identity\Models\User;

/**
 * Someone answered your message. Like a mention, it reaches you even in a
 * muted chat, and it takes the place of the ordinary `message` one.
 */
class ReplyNotification extends ChatNotification
{
    public function type(): string
    {
        return 'reply';
    }

    protected function body(User $notifiable): string
    {
        return $this->line($notifiable, 'reply', ['name' => $this->senderName, 'preview' => $this->preview]);
    }
}
