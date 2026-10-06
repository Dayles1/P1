<?php

namespace App\Domain\Notification\Notifications;

use App\Domain\Identity\Models\User;

/** A message was pinned in a chat you have not muted; `preview` is the pinned message. */
class MessagePinnedNotification extends ChatNotification
{
    public function type(): string
    {
        return 'pinned';
    }

    protected function body(User $notifiable): string
    {
        return $this->line($notifiable, 'pinned', ['name' => $this->senderName, 'preview' => $this->preview]);
    }
}
