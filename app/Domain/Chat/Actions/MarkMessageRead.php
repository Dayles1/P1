<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Events\MessageRead as MessageReadEvent;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\UnreadCounter;
use App\Domain\Identity\Models\User;
use App\Domain\Notification\Actions\MarkNotificationsRead;
use App\Domain\Setting\Services\UserDateFormatter;
use App\Infrastructure\Broadcasting\LiveUpdates;
use Illuminate\Support\Facades\DB;

/**
 * "Read up to and including message X" (default: the last message).
 *
 * The read pointer only moves forward. Receipts (`message_reads`, with the
 * time each message was read — the "Подробно" view shows them) are written
 * in one INSERT … SELECT for the messages between the old and the new
 * pointer, ignoring rows that already exist, so two tabs reading at once
 * never collide. The unread count is recomputed (messages from others after
 * the pointer) instead of zeroed, so reading an older message keeps the
 * newer ones unread.
 */
class MarkMessageRead
{
    public function __construct(
        private readonly MarkNotificationsRead $markNotificationsRead,
        private readonly ChatAccess $access,
        private readonly UnreadCounter $unreadCounter,
        private readonly UserDateFormatter $formatter,
    ) {}

    /**
     * @return array{conversation_id: int, last_read_message_id: int|null, unread_count: int, marked_unread: bool}
     */
    public function handle(User $user, int $conversationId, ?int $messageId = null): array
    {
        $membership = $this->access->membership($user, $conversationId);

        if ($messageId !== null) {
            $messageId = (int) Message::query()
                ->where('conversation_id', $conversationId)
                ->whereKey($messageId)
                ->valueOrFail('id');
        } else {
            $messageId = $membership->conversation->last_message_id !== null
                ? (int) $membership->conversation->last_message_id
                : null;
        }

        return $this->advance($user, $membership, $messageId);
    }

    /**
     * @return array{conversation_id: int, last_read_message_id: int|null, unread_count: int, marked_unread: bool}
     */
    public function advance(User $user, ConversationUser $membership, ?int $messageId): array
    {
        $conversationId = (int) $membership->conversation_id;
        $now = now();

        [$newlyRead, $wasMarkedUnread, $pointer, $unreadCount] = DB::transaction(function () use ($user, $conversationId, $messageId, $now): array {
            $locked = ConversationUser::query()
                ->where('conversation_id', $conversationId)
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();

            $previous = (int) $locked?->last_read_message_id;
            $wasMarkedUnread = (bool) $locked?->marked_unread;
            $target = max($previous, (int) $messageId);
            $newlyRead = 0;

            if ($messageId !== null && $target > $previous) {
                $newlyRead = DB::table('message_reads')->insertOrIgnoreUsing(
                    ['message_id', 'user_id', 'read_at', 'created_at', 'updated_at'],
                    Message::query()
                        ->where('conversation_id', $conversationId)
                        ->where('id', '>', $previous)
                        ->where('id', '<=', $target)
                        ->where('type', '!=', Message::TYPE_SYSTEM)
                        ->where(fn ($query) => $query->whereNull('user_id')->orWhere('user_id', '!=', $user->id))
                        ->select('id')
                        ->selectRaw('?, ?, ?, ?', [$user->id, $now, $now, $now])
                        ->toBase(),
                );
            }

            ConversationUser::query()
                ->where('conversation_id', $conversationId)
                ->where('user_id', $user->id)
                ->update([
                    'last_read_message_id' => $target > 0 ? $target : null,
                    'last_read_at' => $now,
                    'marked_unread' => false,
                ]);

            $this->unreadCounter->recompute($conversationId, [(int) $user->id]);

            $unreadCount = (int) ConversationUser::query()
                ->where('conversation_id', $conversationId)
                ->where('user_id', $user->id)
                ->value('unread_count');

            return [$newlyRead, $wasMarkedUnread, $target > 0 ? $target : null, $unreadCount];
        });

        if ($pointer !== null && ($newlyRead > 0 || $wasMarkedUnread)) {
            LiveUpdates::toOthers(new MessageReadEvent(
                $this->access->memberIds($conversationId),
                $conversationId,
                (int) $user->id,
                $pointer,
                (string) $this->formatter->iso($now, null),
                $unreadCount,
            ));
        }

        if ($pointer !== null) {
            // Reading a message in Chat also clears the notifications it
            // caused — otherwise the bell keeps counting what was plainly seen.
            $this->markNotificationsRead->handle(
                $user,
                $user->notifications()
                    ->where('conversation_id', $conversationId)
                    ->where('message_id', '<=', $pointer),
            );
        }

        return [
            'conversation_id' => $conversationId,
            'last_read_message_id' => $pointer,
            'unread_count' => $unreadCount,
            'marked_unread' => false,
        ];
    }
}
