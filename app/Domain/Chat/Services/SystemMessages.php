<?php

namespace App\Domain\Chat\Services;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\Message;
use App\Domain\Identity\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Service lines in a chat ("Alisher added Maria"). Created by the server
 * only: never edited or reacted to, not counted as unread, not notified.
 * `meta.system` = {event, actor_id, actor_name, params}.
 */
class SystemMessages
{
    public const GROUP_CREATED = 'group_created';

    public const MEMBERS_ADDED = 'members_added';

    public const MEMBER_REMOVED = 'member_removed';

    public const MEMBER_LEFT = 'member_left';

    public const MEMBER_JOINED = 'member_joined';

    public const TITLE_CHANGED = 'title_changed';

    public const DESCRIPTION_CHANGED = 'description_changed';

    public const AVATAR_CHANGED = 'avatar_changed';

    public const AVATAR_REMOVED = 'avatar_removed';

    public const MESSAGE_PINNED = 'message_pinned';

    public const OWNERSHIP_TRANSFERRED = 'ownership_transferred';

    public function __construct(
        private readonly MessageWriter $writer,
    ) {}

    /**
     * Posts the line and broadcasts it to every member.
     *
     * @param  array<string, mixed>  $params
     */
    public function post(Conversation $conversation, ?User $actor, string $event, array $params = []): Message
    {
        $message = DB::transaction(function () use ($conversation, $actor, $event, $params): Message {
            $message = Message::query()->create([
                'conversation_id' => $conversation->id,
                'user_id' => $actor?->id,
                'type' => Message::TYPE_SYSTEM,
                'body' => null,
                'meta' => [
                    'system' => [
                        'event' => $event,
                        'actor_id' => $actor?->id,
                        'actor_name' => $actor?->name,
                        'params' => $params,
                    ],
                ],
            ]);

            $this->writer->record($message);

            return $message;
        });

        $this->writer->announce($message, $actor ?? new User, notify: false);

        return $message;
    }
}
