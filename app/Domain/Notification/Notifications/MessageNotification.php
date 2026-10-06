<?php

namespace App\Domain\Notification\Notifications;

use App\Domain\Identity\Models\User;

/** Fired when a chat message arrives for a recipient who isn't actively viewing that conversation. */
class MessageNotification extends ChatNotification
{
    public function type(): string
    {
        return 'message';
    }

    protected function body(User $notifiable): string
    {
        return "{$this->senderName}: {$this->preview}";
    }
}
