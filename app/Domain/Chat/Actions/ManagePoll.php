<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Events\MessageEdited;
use App\Domain\Chat\Events\PollUpdated;
use App\Domain\Chat\Exceptions\ChatForbidden;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Models\PollVote;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\MessageHydrator;
use App\Domain\Chat\Services\MessageWriter;
use App\Domain\Chat\Services\PollPresenter;
use App\Domain\Identity\Models\User;
use App\Infrastructure\Broadcasting\LiveUpdates;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Polls: creating one (a message of type `poll`), voting, taking a vote
 * back and closing it. Results go to every member as `poll.updated`.
 */
class ManagePoll
{
    public function __construct(
        private readonly ChatAccess $access,
        private readonly MessageWriter $writer,
        private readonly MessageHydrator $hydrator,
        private readonly PollPresenter $presenter,
    ) {}

    /**
     * @param  array<string, mixed>  $data  validated StorePollRequest input
     */
    public function create(User $user, int $conversationId, array $data): Message
    {
        $membership = $this->access->membership($user, $conversationId);
        $this->access->ensureCanPost($membership);
        $clientId = isset($data['client_id']) && $data['client_id'] !== '' ? (string) $data['client_id'] : null;

        $message = DB::transaction(function () use ($user, $membership, $data, $clientId): Message {
            if ($clientId !== null) {
                Conversation::query()->whereKey($membership->conversation_id)->lockForUpdate()->first();

                $existing = Message::query()
                    ->where('conversation_id', $membership->conversation_id)
                    ->where('user_id', $user->id)
                    ->where('meta->client_id', $clientId)
                    ->first();

                if ($existing) {
                    return $existing;
                }
            }

            $message = Message::query()->create([
                'conversation_id' => $membership->conversation_id,
                'user_id' => $user->id,
                'type' => Message::TYPE_POLL,
                'body' => null,
                'meta' => array_filter([
                    'client_id' => $clientId,
                    'poll' => [
                        'question' => (string) $data['question'],
                        'options' => array_values(array_map('strval', (array) $data['options'])),
                        'multiple' => (bool) ($data['multiple'] ?? false),
                        'anonymous' => (bool) ($data['anonymous'] ?? false),
                        'closed_at' => null,
                        'closed_by' => null,
                    ],
                ], fn ($value): bool => $value !== null),
            ]);

            $this->writer->record($message);

            return $message;
        });

        if (! $message->wasRecentlyCreated) {
            return $this->hydrator->hydrate($message);
        }

        return $this->writer->announce($message, $user);
    }

    /**
     * Replaces the member's votes with `$optionIds` (exactly one unless the
     * poll allows several answers).
     *
     * @param  array<int, int>  $optionIds
     */
    public function vote(User $user, int $conversationId, int $messageId, array $optionIds): Message
    {
        [, $message] = $this->openPoll($user, $conversationId, $messageId);
        $poll = $message->meta['poll'];
        $optionIds = array_values(array_unique(array_map('intval', $optionIds)));
        $optionCount = count($poll['options'] ?? []);

        foreach ($optionIds as $optionId) {
            if ($optionId < 0 || $optionId >= $optionCount) {
                throw ValidationException::withMessages(['option_ids' => __('messages.chat.poll_invalid_option')]);
            }
        }

        if ($optionIds === [] || (empty($poll['multiple']) && count($optionIds) !== 1)) {
            throw ValidationException::withMessages(['option_ids' => __('messages.chat.poll_one_option')]);
        }

        DB::transaction(function () use ($user, $message, $optionIds): void {
            PollVote::query()->where('message_id', $message->id)->where('user_id', $user->id)->delete();

            $now = now();
            PollVote::query()->insertOrIgnore(array_map(fn (int $optionId): array => [
                'message_id' => $message->id,
                'user_id' => $user->id,
                'option_id' => $optionId,
                'created_at' => $now,
            ], $optionIds));
        });

        return $this->announce($message);
    }

    public function retract(User $user, int $conversationId, int $messageId): Message
    {
        [, $message] = $this->openPoll($user, $conversationId, $messageId);

        PollVote::query()->where('message_id', $message->id)->where('user_id', $user->id)->delete();

        return $this->announce($message);
    }

    /**
     * Closes the poll — its author, or the chat's creator and admins.
     */
    public function close(User $user, int $conversationId, int $messageId): Message
    {
        [$membership, $message] = $this->openPoll($user, $conversationId, $messageId);

        $mayClose = (int) $message->user_id === (int) $user->id
            || ($this->access->isGroupLike($membership->conversation) && $membership->isManager());

        if (! $mayClose) {
            throw ChatForbidden::because('chat.cannot_close_poll');
        }

        $meta = $message->meta;
        $meta['poll']['closed_at'] = now()->toIso8601String();
        $meta['poll']['closed_by'] = (int) $user->id;
        $message->update(['meta' => $meta]);

        $this->announce($message);

        LiveUpdates::toOthers(new MessageEdited($this->access->memberIds($conversationId), $message));

        return $message;
    }

    /**
     * @return array{0: ConversationUser, 1: Message}
     */
    private function openPoll(User $user, int $conversationId, int $messageId): array
    {
        $membership = $this->access->membership($user, $conversationId);

        $message = Message::query()
            ->where('conversation_id', $conversationId)
            ->where('type', Message::TYPE_POLL)
            ->findOrFail($messageId);

        if (! empty($message->meta['poll']['closed_at'])) {
            throw ValidationException::withMessages(['poll' => __('messages.chat.poll_closed')]);
        }

        return [$membership, $message];
    }

    private function announce(Message $message): Message
    {
        $this->hydrator->hydrate($message);

        LiveUpdates::toOthers(new PollUpdated(
            $this->access->memberIds((int) $message->conversation_id),
            (int) $message->conversation_id,
            (int) $message->id,
            (array) $this->presenter->present($message, null, withMyVotes: false),
        ));

        return $message;
    }
}
