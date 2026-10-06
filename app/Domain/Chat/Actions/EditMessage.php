<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Events\MessageEdited;
use App\Domain\Chat\Exceptions\ChatForbidden;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Models\MessageEdit;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\LinkPreviews;
use App\Domain\Chat\Services\MessageHydrator;
use App\Domain\Identity\Models\User;
use App\Infrastructure\Broadcasting\LiveUpdates;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Edits a text message: your own, or someone else's with an explicit
 * `edit_message` grant. The text it had before is kept as a MessageEdit,
 * so the "Подробно" view can show every earlier version.
 */
class EditMessage
{
    public function __construct(
        private readonly ChatAccess $access,
        private readonly MessageHydrator $hydrator,
        private readonly LinkPreviews $linkPreviews,
    ) {}

    public function handle(User $user, int $conversationId, int $messageId, string $body): Message
    {
        $membership = $this->access->membership($user, $conversationId);

        $message = Message::query()
            ->where('conversation_id', $conversationId)
            ->findOrFail($messageId);

        if ($message->type !== Message::TYPE_TEXT) {
            throw ValidationException::withMessages([
                'message' => __('messages.chat.cannot_edit_this_type'),
            ]);
        }

        if (! ChatPermissions::canModify($membership, $message, 'edit_message')) {
            throw new ChatForbidden('chat.cannot_edit', __('messages.chat.cannot_edit'));
        }

        if ($message->body === $body) {
            return $this->hydrator->hydrate($message);
        }

        $linkChanged = $this->linkPreviews->firstUrl((string) $message->body) !== $this->linkPreviews->firstUrl($body);

        DB::transaction(function () use ($user, $message, $body, $linkChanged): void {
            MessageEdit::query()->create([
                'message_id' => $message->id,
                'user_id' => $user->id,
                'previous_body' => $message->body,
            ]);

            $meta = $message->meta ?? [];

            if ($linkChanged) {
                unset($meta['link_preview']);
            }

            $message->update([
                'body' => $body,
                'edited_at' => now(),
                'meta' => $meta === [] ? null : $meta,
            ]);
        });

        $this->hydrator->hydrate($message);

        LiveUpdates::toOthers(new MessageEdited($this->access->memberIds($conversationId), $message));

        if ($linkChanged) {
            $this->linkPreviews->schedule($message);
        }

        return $message;
    }
}
