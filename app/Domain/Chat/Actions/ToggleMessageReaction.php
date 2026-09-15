<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Events\MessageReactionToggled;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Models\MessageReaction;
use App\Domain\Identity\Models\User;

class ToggleMessageReaction
{
    /**
     * Returns the objective, viewer-independent summary (who reacted with
     * what) — deliberately no `mine` flag baked in here, since this exact
     * same payload is also broadcast to every other participant, for whom
     * "mine" would mean something different. Each client derives its own
     * "did I react" by checking `user_ids` against its own user id.
     *
     * @return array<int, array{emoji: string, count: int, user_ids: array<int, int>}>
     */
    public function handle(User $user, int $conversationId, int $messageId, string $emoji): array
    {
        // Membership check — being a participant is enough to react, no extra permission.
        $user->conversations()->findOrFail($conversationId);

        $message = Message::query()
            ->where('conversation_id', $conversationId)
            ->findOrFail($messageId);

        $existing = MessageReaction::query()
            ->where('message_id', $message->id)
            ->where('user_id', $user->id)
            ->where('emoji', $emoji)
            ->first();

        if ($existing) {
            $existing->delete();
        } else {
            MessageReaction::create([
                'message_id' => $message->id,
                'user_id' => $user->id,
                'emoji' => $emoji,
            ]);
        }

        $summary = $this->summarize($message);

        broadcast(new MessageReactionToggled($conversationId, $message->id, $summary))->toOthers();

        return $summary;
    }

    /** @return array<int, array{emoji: string, count: int, user_ids: array<int, int>}> */
    private function summarize(Message $message): array
    {
        return $message->reactions()
            ->get()
            ->groupBy('emoji')
            ->map(fn ($reactions, $emoji) => [
                'emoji' => $emoji,
                'count' => $reactions->count(),
                'user_ids' => $reactions->pluck('user_id')->all(),
            ])
            ->values()
            ->all();
    }
}
