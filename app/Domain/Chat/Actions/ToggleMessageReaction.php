<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Events\MessageReactionToggled;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Models\MessageReaction;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Identity\Models\User;
use App\Domain\Notification\Services\ChatNotifier;
use App\Infrastructure\Broadcasting\LiveUpdates;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ToggleMessageReaction
{
    public function __construct(
        private readonly ChatAccess $access,
        private readonly ChatNotifier $notifier,
    ) {}

    /**
     * Adds the reaction, or removes it when the member already reacted
     * with that emoji. Done as delete-or-insert-ignore, so a double click
     * never trips the unique key.
     *
     * The summary is viewer-independent (who reacted with what) — the same
     * payload goes to every member; each client checks `user_ids` itself.
     *
     * @return array{reactions: array<int, array{emoji: string, count: int, user_ids: array<int, int>}>, added: bool}
     */
    public function handle(User $user, int $conversationId, int $messageId, string $emoji): array
    {
        $this->access->membership($user, $conversationId);

        $message = Message::query()
            ->where('conversation_id', $conversationId)
            ->findOrFail($messageId);

        if ($message->isSystem()) {
            throw ValidationException::withMessages([
                'emoji' => __('messages.chat.cannot_react_to_system'),
            ]);
        }

        $removed = MessageReaction::query()
            ->where('message_id', $message->id)
            ->where('user_id', $user->id)
            ->where('emoji', $emoji)
            ->delete();

        $added = false;

        if ($removed === 0) {
            $now = now();
            $added = DB::table('message_reactions')->insertOrIgnore([
                'message_id' => $message->id,
                'user_id' => $user->id,
                'emoji' => $emoji,
                'created_at' => $now,
                'updated_at' => $now,
            ]) > 0;
        }

        $summary = $message->load('reactions')->reactionSummary();

        LiveUpdates::toOthers(new MessageReactionToggled(
            $this->access->memberIds($conversationId),
            $conversationId,
            $message->id,
            $summary,
            (int) $user->id,
            $emoji,
            $added,
        ));

        if ($added) {
            $this->notifier->reactionAdded($user, $message, $emoji);
        }

        return ['reactions' => $summary, 'added' => $added];
    }
}
