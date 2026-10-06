<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Models\MessageAttachment;
use App\Domain\Chat\Models\MessageEdit;
use App\Domain\Chat\Models\MessageReaction;
use App\Domain\Chat\Models\MessageRead;
use App\Domain\Chat\Models\PollVote;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\MessageHydrator;
use App\Domain\Identity\Models\User;
use App\Domain\Setting\Services\UserDateFormatter;
use App\Http\Resources\Chat\MessageResource;

/**
 * Everything known about one message ("Подробно"): when it was sent, who
 * read it and when (and who has not yet), every earlier version, who
 * reacted with what and when, who pinned it, where it was forwarded from,
 * its files, and who voted for what in a public poll.
 */
class ShowMessageInfo
{
    public function __construct(
        private readonly ChatAccess $access,
        private readonly MessageHydrator $hydrator,
        private readonly ListMessages $listMessages,
        private readonly UserDateFormatter $formatter,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(User $viewer, int $conversationId, int $messageId): array
    {
        $membership = $this->access->membership($viewer, $conversationId);

        /** @var Message $message */
        $message = $this->listMessages->visible($membership)->findOrFail($messageId);
        $this->hydrator->hydrate($message);
        $message->load(['edits.user:id,name', 'reactions.user.avatar', 'pollVotes.user.avatar']);

        $iso = fn ($date): ?string => $date ? $this->formatter->iso($date, $viewer) : null;
        $person = fn (?User $user): ?array => $user ? ['id' => $user->id, 'name' => $user->name, 'avatar' => $user->avatar?->url] : null;

        [$reads, $unreadBy] = $this->readers($message, $iso, $person);

        $poll = $message->meta['poll'] ?? null;

        return [
            'message' => new MessageResource($message),
            'sent_at_iso' => $iso($message->created_at),
            'sender' => $person($message->user),
            'edits' => [
                'count' => $message->edits->count(),
                'last_edited_at_iso' => $iso($message->edited_at),
                'history' => $message->edits->map(fn (MessageEdit $edit): array => [
                    'previous_body' => $edit->previous_body,
                    'edited_at_iso' => $iso($edit->created_at),
                    'editor' => $edit->user ? ['id' => $edit->user->id, 'name' => $edit->user->name] : null,
                ])->values()->all(),
            ],
            'reads' => $reads,
            'unread_by' => $unreadBy,
            'reactions' => $message->reactions
                ->sortBy('id')
                ->groupBy('emoji')
                ->map(fn ($group, $emoji): array => [
                    'emoji' => (string) $emoji,
                    'users' => $group->map(fn (MessageReaction $reaction): array => [
                        ...($person($reaction->user) ?? ['id' => (int) $reaction->user_id, 'name' => '', 'avatar' => null]),
                        'reacted_at_iso' => $iso($reaction->created_at),
                    ])->values()->all(),
                ])
                ->values()
                ->all(),
            'pinned' => $message->is_pinned ? [
                'pinned_at_iso' => $iso($message->pinned_at),
                'by' => $message->pinnedBy ? ['id' => $message->pinnedBy->id, 'name' => $message->pinnedBy->name] : null,
            ] : null,
            'forwarded_from' => $message->meta['forwarded_from'] ?? null,
            'reply_to' => MessageResource::replyTo($message),
            'attachments' => $message->attachments->map(fn (MessageAttachment $attachment): array => [
                ...MessageResource::attachment($attachment),
                'created_at_iso' => $iso($attachment->created_at),
            ])->values()->all(),
            'poll_voters' => $message->isPoll() && is_array($poll) && empty($poll['anonymous'])
                ? collect(array_values((array) ($poll['options'] ?? [])))->keys()->map(fn (int $optionId): array => [
                    'option_id' => $optionId,
                    'users' => $message->pollVotes
                        ->where('option_id', $optionId)
                        ->sortBy('id')
                        ->map(fn (PollVote $vote): array => [
                            ...($person($vote->user) ?? ['id' => (int) $vote->user_id, 'name' => '', 'avatar' => null]),
                            'voted_at_iso' => $iso($vote->created_at),
                        ])->values()->all(),
                ])->all()
                : null,
        ];
    }

    /**
     * Who read it (with when, earliest first) and which current members
     * have not — the sender left out of both. A member whose read pointer
     * passed the message before receipts were recorded counts as a reader
     * without a time.
     *
     * @return array{0: array<int, array<string, mixed>>, 1: array<int, array<string, mixed>>}
     */
    private function readers(Message $message, callable $iso, callable $person): array
    {
        $senderId = (int) $message->user_id;

        $receipts = MessageRead::query()
            ->where('message_id', $message->id)
            ->where('user_id', '!=', $senderId)
            ->with('user.avatar')
            ->orderBy('read_at')
            ->orderBy('id')
            ->get();

        $members = ConversationUser::query()
            ->where('conversation_id', $message->conversation_id)
            ->whereNull('left_at')
            ->where('user_id', '!=', $senderId)
            ->with('user.avatar')
            ->get();

        $readerIds = $receipts->pluck('user_id')->map(fn ($id): int => (int) $id)->all();

        $reads = $receipts
            ->filter(fn (MessageRead $read): bool => $read->user !== null)
            ->map(fn (MessageRead $read): array => [
                'user' => $person($read->user),
                'read_at_iso' => $iso($read->read_at),
            ])
            ->values()
            ->all();

        foreach ($members as $member) {
            if ($member->user && ! in_array((int) $member->user_id, $readerIds, true) && (int) $member->last_read_message_id >= (int) $message->id) {
                $reads[] = ['user' => $person($member->user), 'read_at_iso' => null];
                $readerIds[] = (int) $member->user_id;
            }
        }

        $unreadBy = $message->isSystem() ? [] : $members
            ->filter(fn (ConversationUser $member): bool => $member->user !== null && ! in_array((int) $member->user_id, $readerIds, true))
            ->map(fn (ConversationUser $member): ?array => $person($member->user))
            ->values()
            ->all();

        return [$reads, $unreadBy];
    }
}
