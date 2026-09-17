<?php

namespace App\Domain\Notification\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Fired whenever one or more of a user's notifications flip to read —
 * whether from an explicit click in the bell/Notification Center, or as a
 * side effect of reading the underlying message in Chat (see
 * MarkNotificationsRead / MarkMessageRead). ShouldBroadcastNow, not
 * ShouldBroadcast: this is small, cheap, and the whole point is the badge
 * updating live across tabs — a queued delay would defeat that, same
 * reasoning the codebase already uses for UserTyping.
 */
class NotificationsMarkedRead implements ShouldBroadcastNow
{
    use Dispatchable;

    /** @param array<int, string> $notificationIds */
    public function __construct(
        public int $userId,
        public array $notificationIds,
        public int $unreadCount,
    ) {}

    /** @return array<int, Channel> */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("App.Models.User.{$this->userId}")];
    }

    public function broadcastAs(): string
    {
        return 'notifications.read';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return [
            'ids' => $this->notificationIds,
            'unread_count' => $this->unreadCount,
        ];
    }
}
