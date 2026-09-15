<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Events\MessageSent;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Identity\Models\User;
use App\Domain\Notification\Notifications\MentionNotification;
use App\Domain\Notification\Notifications\MessageNotification;
use App\Infrastructure\Storage\FileStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SendMessage
{
    public function __construct(
        protected FileStorage $fileStorage,
    ) {}

    public function handle(User $user, int $conversationId, array $data): Message
    {
        $conversation = $user->conversations()->findOrFail($conversationId);

        $message = DB::transaction(function () use ($user, $conversation, $data) {
            $message = Message::create([
                'conversation_id' => $conversation->id,
                'user_id' => $user->id,
                'parent_message_id' => $data['parent_message_id'] ?? null,
                'type' => 'text',
                'body' => $data['body'] ?? '',
            ]);

            foreach ($data['attachments'] ?? [] as $file) {
                $stored = $this->fileStorage->store($file, "chat/{$conversation->id}", 'public');

                $message->attachments()->create([
                    'disk' => $stored['disk'],
                    'path' => $stored['path'],
                    'original_name' => $stored['name'],
                    'mime_type' => $stored['mime_type'],
                    'size' => $stored['size'],
                    ...($this->imageDimensions($file) ?? []),
                ]);
            }

            $conversation->update([
                'last_message_id' => $message->id,
                'last_message_at' => $message->created_at,
            ]);

            ConversationUser::query()
                ->where('conversation_id', $conversation->id)
                ->where('user_id', '!=', $user->id)
                ->whereNull('left_at')
                ->increment('unread_count');

            ConversationUser::query()
                ->where('conversation_id', $conversation->id)
                ->where('user_id', $user->id)
                ->update([
                    'unread_count' => 0,
                    'last_read_message_id' => $message->id,
                    'last_read_at' => $message->created_at,
                ]);

            return $message->load('user.avatar', 'attachments', 'reactions', 'parent.user');
        });

        $this->notifyParticipants($user, $conversation, $message);

        broadcast(new MessageSent($message))->toOthers();

        return $message;
    }

    /** @return array{width: int, height: int}|null */
    private function imageDimensions(UploadedFile $file): ?array
    {
        if (! str_starts_with((string) $file->getMimeType(), 'image/')) {
            return null;
        }

        $size = @getimagesize($file->getRealPath());

        return $size ? ['width' => $size[0], 'height' => $size[1]] : null;
    }

    /** @return array<int, int> user ids mentioned via `@[Name](id)` tokens in the body */
    private function mentionedUserIds(string $body, Conversation $conversation): array
    {
        preg_match_all('/@\[[^\]]+\]\((\d+)\)/', $body, $matches);
        $mentioned = array_map('intval', array_unique($matches[1] ?? []));

        if (! $mentioned) {
            return [];
        }

        // Only mentions of actual current members count — a stale/tampered
        // token pointing at someone who was never in the conversation
        // (or already left) doesn't get to force a notification.
        return $conversation->users()->whereIn('users.id', $mentioned)->pluck('users.id')->all();
    }

    private function notifyParticipants(User $sender, Conversation $conversation, Message $message): void
    {
        $mentionedIds = $this->mentionedUserIds($message->body ?? '', $conversation);
        $preview = Str::limit(strip_tags($message->body ?? ''), 120);

        foreach ($conversation->users as $participant) {
            if ((int) $participant->id === (int) $sender->id) {
                continue;
            }

            if (in_array((int) $participant->id, $mentionedIds, true)) {
                $participant->notify(new MentionNotification(
                    conversationId: $conversation->id,
                    messageId: $message->id,
                    conversationTitle: $conversation->title ?? $sender->name,
                    senderName: $sender->name,
                    preview: $preview,
                ));

                continue;
            }

            $membership = $participant->pivot;

            if (! $membership?->notifications_enabled) {
                continue;
            }

            if ($membership->muted_until && $membership->muted_until->isFuture()) {
                continue;
            }

            $participant->notify(new MessageNotification(
                conversationId: $conversation->id,
                conversationTitle: $conversation->title ?? $sender->name,
                senderName: $sender->name,
                preview: $preview,
            ));
        }
    }
}
