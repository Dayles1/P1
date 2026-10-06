<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\MessageWriter;
use App\Domain\Identity\Models\User;
use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Forwards messages into one or more chats. Per target: the optional
 * comment first, then copies in their original order — text, attachments
 * (pointing at the same files) and `meta.forwarded_from` (unless the sender
 * is hidden; forwarding a forward keeps the original origin). Polls arrive
 * as fresh polls without votes; service lines are skipped. Each copy is
 * broadcast and notified like a normal send.
 */
class ForwardMessages
{
    public function __construct(
        private readonly ChatAccess $access,
        private readonly MessageWriter $writer,
        private readonly ListMessages $listMessages,
        private readonly UserDateFormatter $formatter,
    ) {}

    /**
     * @param  array<int, int>  $messageIds
     * @param  array<int, int>  $conversationIds
     * @return array<int, array{conversation_id: int, messages: Collection<int, Message>}>
     */
    public function handle(User $user, int $fromConversationId, array $messageIds, array $conversationIds, ?string $comment = null, bool $hideSender = false): array
    {
        $source = $this->access->membership($user, $fromConversationId);

        $originals = $this->listMessages->visible($source)
            ->whereIn('id', array_map('intval', $messageIds))
            ->where('type', '!=', Message::TYPE_SYSTEM)
            ->with(['user:id,name', 'attachments', 'conversation'])
            ->orderBy('id')
            ->get();

        $targets = collect(array_values(array_unique(array_map('intval', $conversationIds))))
            ->map(function (int $conversationId) use ($user): ConversationUser {
                $membership = $this->access->membership($user, $conversationId);
                $this->access->ensureCanPost($membership);

                return $membership;
            });

        $comment = $comment !== null && trim($comment) !== '' ? $comment : null;
        $results = [];

        foreach ($targets as $target) {
            $created = DB::transaction(function () use ($user, $target, $originals, $comment, $hideSender): array {
                $created = [];

                if ($comment !== null) {
                    $created[] = $this->create($target->conversation, $user, [
                        'type' => Message::TYPE_TEXT,
                        'body' => $comment,
                        'meta' => null,
                    ]);
                }

                foreach ($originals as $original) {
                    $copy = $this->create($target->conversation, $user, [
                        'type' => $original->type,
                        'body' => $original->body,
                        'meta' => $this->copyMeta($original, $hideSender),
                    ]);

                    foreach ($original->attachments as $attachment) {
                        $copy->attachments()->create($attachment->only([
                            'disk', 'path', 'original_name', 'mime_type', 'size', 'width', 'height', 'duration', 'meta',
                        ]));
                    }

                    $created[] = $copy;
                }

                return $created;
            });

            foreach ($created as $message) {
                $this->writer->announce($message, $user);
            }

            $results[] = [
                'conversation_id' => (int) $target->conversation_id,
                'messages' => new Collection($created),
            ];
        }

        return $results;
    }

    /**
     * @param  array{type: string, body: string|null, meta: array<string, mixed>|null}  $attributes
     */
    private function create(Conversation $conversation, User $user, array $attributes): Message
    {
        $message = Message::query()->create([
            'conversation_id' => $conversation->id,
            'user_id' => $user->id,
            ...$attributes,
        ]);

        $this->writer->record($message);

        return $message;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function copyMeta(Message $original, bool $hideSender): ?array
    {
        $meta = [];

        if (! empty($original->meta['link_preview'])) {
            $meta['link_preview'] = $original->meta['link_preview'];
        }

        if ($original->isPoll() && isset($original->meta['poll'])) {
            $meta['poll'] = [
                ...$original->meta['poll'],
                'closed_at' => null,
                'closed_by' => null,
            ];
        }

        if (! $hideSender) {
            $meta['forwarded_from'] = $original->meta['forwarded_from'] ?? [
                'message_id' => $original->id,
                'conversation_id' => (int) $original->conversation_id,
                'conversation_title' => $original->conversation?->isGroupLike() ? $original->conversation->title : null,
                'sender_id' => $original->user_id !== null ? (int) $original->user_id : null,
                'sender_name' => (string) ($original->user->name ?? ''),
                'created_at_iso' => $this->formatter->iso($original->created_at, null),
            ];
        }

        return $meta === [] ? null : $meta;
    }
}
