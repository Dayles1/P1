<?php

namespace App\Http\Resources\Chat;

use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Models\MessageAttachment;
use App\Domain\Chat\Services\MessageHydrator;
use App\Domain\Chat\Services\PollPresenter;
use App\Domain\Identity\Models\User;
use App\Domain\Setting\Services\UserDateFormatter;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * One chat message (SPEC 2.1). Load it through MessageHydrator first so a
 * page of them costs a fixed number of queries.
 *
 * Rendered for a broadcast (forBroadcast()), it is viewer-neutral: no
 * `is_mine`, no `my_votes`, no formatted strings — only ISO times.
 *
 * @mixin Message
 */
class MessageResource extends JsonResource
{
    private bool $broadcast = false;

    /**
     * The viewer-neutral payload sent to every member over Reverb.
     *
     * @return array<string, mixed>
     */
    public static function forBroadcast(Message $message): array
    {
        $resource = new self($message);
        $resource->broadcast = true;

        return $resource->resolve();
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Message $message */
        $message = $this->resource;
        $viewer = $this->broadcast ? null : $request->user();
        $formatter = app(UserDateFormatter::class);
        $readCount = app(MessageHydrator::class)->readCount($message);

        $data = [
            'id' => $message->id,
            'conversation_id' => (int) $message->conversation_id,
            'client_id' => $message->meta['client_id'] ?? null,
            'type' => $message->type,
            'body' => $message->body,
            'sender' => $message->user ? [
                'id' => $message->user->id,
                'name' => $message->user->name,
                'avatar' => $message->user->avatar?->url,
            ] : null,
        ];

        if (! $this->broadcast) {
            $data['is_mine'] = $viewer !== null && (int) $message->user_id === (int) $viewer->id;
        }

        $data += [
            'parent_message_id' => $message->parent_message_id,
            'reply_to' => self::replyTo($message),
            'forwarded_from' => $message->meta['forwarded_from'] ?? null,
            'attachments' => $message->attachments
                ->map(fn (MessageAttachment $attachment): array => self::attachment($attachment))
                ->values()
                ->all(),
            'reactions' => $message->reactionSummary(),
            'read_count' => $readCount,
            'is_read' => $readCount > 0,
            'is_pinned' => (bool) $message->is_pinned,
            'pinned_at_iso' => $this->iso($formatter, $message->pinned_at, $viewer),
            'pinned_by' => $message->is_pinned && $message->pinnedBy ? [
                'id' => $message->pinnedBy->id,
                'name' => $message->pinnedBy->name,
            ] : null,
            'edit_count' => (int) ($message->edits_count ?? $message->edits()->count()),
            'edited_at_iso' => $this->iso($formatter, $message->edited_at, $viewer),
            'created_at_iso' => $this->iso($formatter, $message->created_at, $viewer),
        ];

        if (! $this->broadcast) {
            $data['created_at'] = $formatter->format($message->created_at, $viewer);
            $data['edited_at'] = $formatter->format($message->edited_at, $viewer);
        }

        $data['poll'] = app(PollPresenter::class)->present($message, $viewer?->id, withMyVotes: ! $this->broadcast);
        $data['system'] = self::system($message);
        $data['link_preview'] = $message->meta['link_preview'] ?? null;

        return $data;
    }

    /**
     * The quoted message — only when it is in the same conversation and not deleted.
     *
     * @return array{id: int, type: string, body: string|null, sender_id: int|null, sender_name: string|null, attachment_kind: string|null}|null
     */
    public static function replyTo(Message $message): ?array
    {
        $parent = $message->parent;

        if (! $parent || (int) $parent->conversation_id !== (int) $message->conversation_id) {
            return null;
        }

        return [
            'id' => $parent->id,
            'type' => $parent->type,
            'body' => $parent->isPoll() ? ($parent->meta['poll']['question'] ?? null) : $parent->body,
            'sender_id' => $parent->user_id !== null ? (int) $parent->user_id : null,
            'sender_name' => $parent->user?->name,
            'attachment_kind' => $parent->attachments->first()?->kind(),
        ];
    }

    /**
     * @return array{id: int, url: string|null, original_name: string, mime_type: string|null, size: int, width: int|null, height: int|null, duration: int|null, kind: string}
     */
    public static function attachment(MessageAttachment $attachment): array
    {
        return [
            'id' => $attachment->id,
            'url' => $attachment->url,
            'original_name' => (string) $attachment->original_name,
            'mime_type' => $attachment->mime_type,
            'size' => (int) $attachment->size,
            'width' => $attachment->width,
            'height' => $attachment->height,
            'duration' => $attachment->duration,
            'kind' => $attachment->kind(),
        ];
    }

    /**
     * @return array{event: string, actor: array{id: int, name: string}|null, params: object}|null
     */
    public static function system(Message $message): ?array
    {
        $system = $message->meta['system'] ?? null;

        if (! $message->isSystem() || ! is_array($system)) {
            return null;
        }

        return [
            'event' => (string) ($system['event'] ?? ''),
            'actor' => isset($system['actor_id']) ? [
                'id' => (int) $system['actor_id'],
                'name' => (string) ($system['actor_name'] ?? ''),
            ] : null,
            'params' => (object) ($system['params'] ?? []),
        ];
    }

    private function iso(UserDateFormatter $formatter, mixed $date, ?User $viewer): ?string
    {
        return $date ? $formatter->iso($date, $viewer) : null;
    }
}
