<?php

namespace App\Domain\Chat\Services;

use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use Illuminate\Database\Eloquent\Collection;

/**
 * Loads everything MessageResource renders, for a whole page of messages
 * in a fixed number of queries: relations, the edit count, and read
 * receipts — counted from the members' read pointers rather than from one
 * row per message per member.
 */
class MessageHydrator
{
    /** @var array<int, string> */
    public const RELATIONS = [
        'user.avatar',
        'attachments',
        'reactions',
        'parent.user',
        'parent.attachments',
        'pinnedBy:id,name',
        'pollVotes',
    ];

    /**
     * @param  Message|Collection<int, Message>  $messages
     * @return ($messages is Message ? Message : Collection<int, Message>)
     */
    public function hydrate(Message|Collection $messages): Message|Collection
    {
        $collection = $messages instanceof Message ? new Collection([$messages]) : $messages;

        if ($collection->isEmpty()) {
            return $messages;
        }

        $collection->load(self::RELATIONS);
        $collection->loadCount('edits');
        $this->annotateReadCounts($collection);

        return $messages;
    }

    /**
     * @param  Collection<int, Message>  $messages
     */
    public function annotateReadCounts(Collection $messages): void
    {
        $pointers = ConversationUser::query()
            ->whereIn('conversation_id', $messages->pluck('conversation_id')->unique()->values())
            ->whereNull('left_at')
            ->get(['conversation_id', 'user_id', 'last_read_message_id'])
            ->groupBy('conversation_id');

        foreach ($messages as $message) {
            $message->readCount = $pointers->get($message->conversation_id, new Collection)
                ->filter(fn (ConversationUser $pointer): bool => (int) $pointer->user_id !== (int) $message->user_id
                    && (int) $pointer->last_read_message_id >= (int) $message->id)
                ->count();
        }
    }

    public function readCount(Message $message): int
    {
        if ($message->readCount === null) {
            $this->annotateReadCounts(new Collection([$message]));
        }

        return (int) $message->readCount;
    }
}
