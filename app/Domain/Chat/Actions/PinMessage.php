<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Events\MessageEdited;
use App\Domain\Chat\Exceptions\ChatForbidden;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\MessageHydrator;
use App\Domain\Chat\Services\MessagePreview;
use App\Domain\Chat\Services\SystemMessages;
use App\Domain\Identity\Models\User;
use App\Domain\Notification\Services\ChatNotifier;
use App\Infrastructure\Broadcasting\LiveUpdates;
use Illuminate\Validation\ValidationException;

/**
 * Pins and unpins messages. Any member may in private chats and groups;
 * in a channel only its creator and admins. Pinning leaves a service line
 * ("Alisher pinned «…»") and notifies the members.
 */
class PinMessage
{
    public function __construct(
        private readonly ChatAccess $access,
        private readonly MessageHydrator $hydrator,
        private readonly SystemMessages $systemMessages,
        private readonly MessagePreview $preview,
        private readonly ChatNotifier $notifier,
    ) {}

    public function handle(User $user, int $conversationId, int $messageId): Message
    {
        [$membership, $message] = $this->resolve($user, $conversationId, $messageId);

        if ($message->isSystem()) {
            throw ValidationException::withMessages([
                'message' => __('messages.chat.cannot_pin_system'),
            ]);
        }

        // Already pinned: keep the original pinned_at (the pinned list's order).
        if ($message->is_pinned) {
            return $this->hydrator->hydrate($message);
        }

        $message->update(['is_pinned' => true, 'pinned_at' => now(), 'pinned_by' => $user->id]);
        $this->hydrator->hydrate($message);

        LiveUpdates::toOthers(new MessageEdited($this->access->memberIds($conversationId), $message));

        if ($membership->conversation->type !== Conversation::TYPE_SAVED) {
            $this->systemMessages->post($membership->conversation, $user, SystemMessages::MESSAGE_PINNED, [
                'message_id' => $message->id,
                'preview' => $this->preview->for($message, 60),
            ]);

            $this->notifier->messagePinned($user, $message);
        }

        return $message;
    }

    public function unpin(User $user, int $conversationId, int $messageId): Message
    {
        [, $message] = $this->resolve($user, $conversationId, $messageId);

        if (! $message->is_pinned) {
            return $this->hydrator->hydrate($message);
        }

        $message->update(['is_pinned' => false, 'pinned_at' => null, 'pinned_by' => null]);
        $this->hydrator->hydrate($message);

        LiveUpdates::toOthers(new MessageEdited($this->access->memberIds($conversationId), $message));

        return $message;
    }

    /**
     * @return array{0: ConversationUser, 1: Message}
     */
    private function resolve(User $user, int $conversationId, int $messageId): array
    {
        $membership = $this->access->membership($user, $conversationId);

        if ($membership->conversation->type === Conversation::TYPE_CHANNEL && ! $membership->isManager()) {
            throw ChatForbidden::because('chat.cannot_pin');
        }

        $message = Message::query()
            ->where('conversation_id', $conversationId)
            ->findOrFail($messageId);

        return [$membership, $message];
    }
}
