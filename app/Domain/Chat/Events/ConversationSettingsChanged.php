<?php

namespace App\Domain\Chat\Events;

use App\Domain\Chat\Events\Concerns\BroadcastsToMembers;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * A member's own settings for a chat (mute, archive, pin, marked unread)
 * changed — sent to that member's other devices.
 */
class ConversationSettingsChanged implements ShouldBroadcastNow
{
    use BroadcastsToMembers, Dispatchable, InteractsWithSockets;

    /**
     * @param  array<int, int>  $userIds
     * @param  array<string, mixed>  $settings
     */
    public function __construct(
        public array $userIds,
        public array $settings,
    ) {}

    public function broadcastAs(): string
    {
        return 'conversation.settings';
    }

    /** @return array<string, mixed> */
    public function broadcastWith(): array
    {
        return $this->settings;
    }
}
