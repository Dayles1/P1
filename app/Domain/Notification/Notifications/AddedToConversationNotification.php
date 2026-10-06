<?php

namespace App\Domain\Notification\Notifications;

use App\Domain\Identity\Models\User;

/** You were added to a group or channel (`message_id` is null). */
class AddedToConversationNotification extends ChatNotification
{
    public function type(): string
    {
        return 'added_to_chat';
    }

    protected function body(User $notifiable): string
    {
        return $this->line(
            $notifiable,
            $this->conversationType === 'channel' ? 'added_to_channel' : 'added_to_chat',
            ['name' => $this->senderName, 'chat' => $this->conversationTitle],
        );
    }
}
