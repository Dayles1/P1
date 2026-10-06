<?php

namespace App\Domain\Chat\Events\Concerns;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;

/**
 * A chat event sent to people's own user channels (`App.Models.User.{id}`)
 * — one event, many channels; the Pusher broadcaster batches 100 channels
 * per call to Reverb. The recipients are worked out when the event is
 * created, from the current members, so someone removed from a chat stops
 * hearing about it at once.
 *
 * @property array<int, int> $userIds
 */
trait BroadcastsToMembers
{
    /** @return array<int, Channel> */
    public function broadcastOn(): array
    {
        return array_map(
            fn (int $userId): PrivateChannel => new PrivateChannel("App.Models.User.{$userId}"),
            array_values(array_unique(array_map('intval', $this->userIds))),
        );
    }

    /**
     * Nobody to tell — nothing goes to Reverb.
     */
    public function broadcastWhen(): bool
    {
        return $this->userIds !== [];
    }
}
