<?php

namespace App\Domain\Notification\Services;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Services\MessagePreview;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserBlock;
use App\Domain\Notification\Notifications\AddedToConversationNotification;
use App\Domain\Notification\Notifications\BaseNotification;
use App\Domain\Notification\Notifications\MentionNotification;
use App\Domain\Notification\Notifications\MessageNotification;
use App\Domain\Notification\Notifications\MessagePinnedNotification;
use App\Domain\Notification\Notifications\ReactionNotification;
use App\Domain\Notification\Notifications\ReplyNotification;
use App\Infrastructure\Broadcasting\LiveUpdates;
use Illuminate\Support\Traits\Localizable;

/**
 * Who in a chat hears about what happened in it. Chat actions call this
 * at the moment something happens; the rules live here, in one place,
 * instead of in every action:
 *
 * - nobody is told about their own action, nor about anything done by
 *   someone they blocked, nor about service (system) messages;
 * - a mention, or a reply to your own message, always arrives — even in a
 *   muted chat; everything else stays quiet in a muted chat;
 * - the per-type preferences are applied by BaseNotification::via().
 *
 * Every notification is sent straight to Reverb in the same request
 * (see BaseNotification::toBroadcast), so it pops up immediately without
 * a queue worker.
 */
class ChatNotifier
{
    use Localizable;

    /** @var array<string, string> previews already built, by message id, locale and length */
    private array $previewCache = [];

    public function __construct(
        private readonly MessagePreview $previews,
    ) {}

    /**
     * A new message: a mention for those it mentions, a reply for the
     * author of the message it answers, an ordinary notification for the
     * other members who have not muted the chat.
     */
    public function messageSent(User $sender, Conversation $conversation, Message $message): void
    {
        if ($message->isSystem() || $conversation->type === Conversation::TYPE_SAVED) {
            return;
        }

        $conversation->loadMissing('users.settings');

        $recipients = $conversation->users
            ->reject(fn (User $user): bool => (int) $user->id === (int) $sender->id)
            ->values();

        if ($recipients->isEmpty()) {
            return;
        }

        $recipientIds = $recipients->map(fn (User $user): int => (int) $user->id)->all();
        $blockers = $this->blockersOf($sender, $recipientIds);
        $mentionedIds = array_values(array_intersect($this->mentionedUserIds((string) $message->body), $recipientIds));
        $repliedToId = $this->repliedToUserId($message);
        $actor = BaseNotification::actorPayload($sender);
        $title = $this->titleFor($conversation, $sender);

        foreach ($recipients as $recipient) {
            $recipientId = (int) $recipient->id;

            if (in_array($recipientId, $blockers, true)) {
                continue;
            }

            $arguments = [
                'conversationId' => (int) $conversation->id,
                'messageId' => (int) $message->id,
                'conversationTitle' => $title,
                'senderName' => (string) $sender->name,
                'preview' => $this->previewFor($message, $recipient),
                'actor' => $actor,
                'conversationType' => (string) $conversation->type,
            ];

            if (in_array($recipientId, $mentionedIds, true)) {
                $notification = new MentionNotification(...$arguments);
            } elseif ($recipientId === $repliedToId) {
                $notification = new ReplyNotification(...$arguments);
            } elseif ($this->isMuted($recipient)) {
                continue;
            } else {
                $notification = new MessageNotification(...$arguments);
            }

            LiveUpdates::safely(fn () => $recipient->notify($notification));
        }
    }

    /**
     * `$actor` added these people to a group or channel.
     *
     * @param  array<int, int>  $userIds
     */
    public function membersAdded(User $actor, Conversation $conversation, array $userIds): void
    {
        if (! in_array($conversation->type, [Conversation::TYPE_GROUP, Conversation::TYPE_CHANNEL], true)) {
            return;
        }

        $userIds = array_values(array_diff(array_map('intval', $userIds), [(int) $actor->id]));

        if ($userIds === []) {
            return;
        }

        $blockers = $this->blockersOf($actor, $userIds);
        $actorPayload = BaseNotification::actorPayload($actor);

        User::query()
            ->with('settings')
            ->whereKey(array_values(array_diff($userIds, $blockers)))
            ->get()
            ->each(fn (User $user) => LiveUpdates::safely(fn () => $user->notify(new AddedToConversationNotification(
                conversationId: (int) $conversation->id,
                messageId: null,
                conversationTitle: (string) $conversation->title,
                senderName: (string) $actor->name,
                preview: '',
                actor: $actorPayload,
                conversationType: (string) $conversation->type,
            ))));
    }

    /**
     * `$actor` put a reaction on someone's message — its author hears
     * about it, unless they muted the chat or blocked the actor.
     */
    public function reactionAdded(User $actor, Message $message, string $emoji): void
    {
        $authorId = (int) $message->user_id;

        if ($message->isSystem() || $authorId === 0 || $authorId === (int) $actor->id) {
            return;
        }

        $membership = ConversationUser::query()
            ->with(['user.settings', 'conversation'])
            ->where('conversation_id', $message->conversation_id)
            ->where('user_id', $authorId)
            ->whereNull('left_at')
            ->first();

        $author = $membership?->user;
        $conversation = $membership?->conversation;

        if (! $author || ! $conversation || $membership->isMuted() || $this->blockersOf($actor, [$authorId]) !== []) {
            return;
        }

        LiveUpdates::safely(fn () => $author->notify(new ReactionNotification(
            conversationId: (int) $conversation->id,
            messageId: (int) $message->id,
            conversationTitle: $this->titleFor($conversation, $actor),
            senderName: (string) $actor->name,
            preview: $this->previewFor($message, $author, 80),
            emoji: $emoji,
            actor: BaseNotification::actorPayload($actor),
            conversationType: (string) $conversation->type,
        )));
    }

    /**
     * `$actor` pinned a message — the other members who have not muted the
     * chat hear about it.
     */
    public function messagePinned(User $actor, Message $message): void
    {
        if ($message->isSystem()) {
            return;
        }

        $conversation = Conversation::query()->with('users.settings')->find($message->conversation_id);

        if (! $conversation || $conversation->type === Conversation::TYPE_SAVED) {
            return;
        }

        $recipients = $conversation->users
            ->reject(fn (User $user): bool => (int) $user->id === (int) $actor->id || $this->isMuted($user))
            ->values();

        if ($recipients->isEmpty()) {
            return;
        }

        $blockers = $this->blockersOf($actor, $recipients->map(fn (User $user): int => (int) $user->id)->all());
        $actorPayload = BaseNotification::actorPayload($actor);
        $title = $this->titleFor($conversation, $actor);

        foreach ($recipients as $recipient) {
            if (in_array((int) $recipient->id, $blockers, true)) {
                continue;
            }

            LiveUpdates::safely(fn () => $recipient->notify(new MessagePinnedNotification(
                conversationId: (int) $conversation->id,
                messageId: (int) $message->id,
                conversationTitle: $title,
                senderName: (string) $actor->name,
                preview: $this->previewFor($message, $recipient, 80),
                actor: $actorPayload,
                conversationType: (string) $conversation->type,
            )));
        }
    }

    /**
     * A group is called by its title; a private chat, from the
     * recipient's side, by the person on the other end.
     */
    private function titleFor(Conversation $conversation, User $actor): string
    {
        $title = $conversation->type === Conversation::TYPE_PRIVATE ? null : $conversation->title;

        return (string) ($title ?: $actor->name);
    }

    /** Whether this member silenced the chat (`$user` loaded through Conversation::users). */
    private function isMuted(User $user): bool
    {
        $membership = $user->relationLoaded('pivot') ? $user->getRelation('pivot') : null;

        return $membership instanceof ConversationUser && $membership->isMuted();
    }

    /**
     * Which of these people blocked `$actor` — one query, not one per person.
     *
     * @param  array<int, int>  $userIds
     * @return array<int, int>
     */
    private function blockersOf(User $actor, array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        return UserBlock::query()
            ->where('blocked_user_id', $actor->id)
            ->whereIn('user_id', $userIds)
            ->pluck('user_id')
            ->map(fn ($id): int => (int) $id)
            ->all();
    }

    /** The author of the message this one answers, if it is in the same chat and still there. */
    private function repliedToUserId(Message $message): ?int
    {
        if (! $message->parent_message_id) {
            return null;
        }

        $parent = $message->relationLoaded('parent') ? $message->parent : $message->parent()->first();

        if (! $parent || $parent->trashed() || $parent->isSystem() || (int) $parent->conversation_id !== (int) $message->conversation_id) {
            return null;
        }

        return $parent->user_id ? (int) $parent->user_id : null;
    }

    /**
     * The message as one readable line in the recipient's language — never
     * empty and never with raw `@[Name](id)` tokens: an attachment reads
     * "Фото" / "Голосовое сообщение", a poll "📊 question".
     */
    private function previewFor(Message $message, User $recipient, int $limit = 120): string
    {
        $locale = $recipient->settings?->locale ?: app()->getLocale();
        $key = "{$message->id}:{$locale}:{$limit}";

        return $this->previewCache[$key] ??= $this->withLocale($locale, function () use ($message, $limit): string {
            $text = $this->previews->for($message, $limit);

            if ($text !== '') {
                return $text;
            }

            return (string) __(isset($message->meta['forwarded_from'])
                ? 'ui.notifications.server.preview_forwarded'
                : 'ui.notifications.server.preview_message');
        });
    }

    /** @return array<int, int> user ids mentioned via `@[Name](id)` tokens in the body */
    private function mentionedUserIds(string $body): array
    {
        preg_match_all(MessagePreview::MENTION_PATTERN, $body, $matches);

        return array_values(array_unique(array_map('intval', $matches[2])));
    }
}
