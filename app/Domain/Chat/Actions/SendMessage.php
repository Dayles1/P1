<?php

namespace App\Domain\Chat\Actions;

use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Services\ChatAccess;
use App\Domain\Chat\Services\LinkPreviews;
use App\Domain\Chat\Services\MessageHydrator;
use App\Domain\Chat\Services\MessageWriter;
use App\Domain\Identity\Models\User;
use App\Http\Requests\Chat\StoreMessageRequest;
use App\Infrastructure\Storage\FileStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Throwable;

class SendMessage
{
    public function __construct(
        protected FileStorage $fileStorage,
        protected ChatAccess $access,
        protected MessageWriter $writer,
        protected MessageHydrator $hydrator,
        protected LinkPreviews $linkPreviews,
    ) {}

    /**
     * @param  array{body?: string|null, parent_message_id?: int|null, client_id?: string|null, attachments?: array<int, UploadedFile>, attachment_meta?: array<int, array{duration?: int|null, voice?: bool|null}>}  $data
     */
    public function handle(User $user, int $conversationId, array $data): Message
    {
        $membership = $this->access->membership($user, $conversationId);
        $this->access->ensureCanPost($membership);
        $conversation = $membership->conversation;
        $clientId = isset($data['client_id']) && $data['client_id'] !== '' ? (string) $data['client_id'] : null;

        if ($clientId !== null && ($existing = $this->findByClientId($user, $conversation, $clientId))) {
            return $this->hydrator->hydrate($existing);
        }

        // Files are written before the transaction and removed again if it
        // fails, so a rollback leaves nothing behind on disk.
        $stored = $this->storeAttachments($conversation, $data);

        try {
            $message = DB::transaction(function () use ($user, $conversation, $data, $clientId, $stored): Message {
                if ($clientId !== null) {
                    // Serialises sends into this conversation, so a retry racing
                    // the original request still finds it below.
                    Conversation::query()->whereKey($conversation->id)->lockForUpdate()->first();

                    $existing = $this->findByClientId($user, $conversation, $clientId);

                    if ($existing) {
                        return $existing;
                    }
                }

                $message = Message::query()->create([
                    'conversation_id' => $conversation->id,
                    'user_id' => $user->id,
                    'parent_message_id' => $data['parent_message_id'] ?? null,
                    'type' => Message::TYPE_TEXT,
                    'body' => isset($data['body']) && $data['body'] !== '' ? $data['body'] : null,
                    'meta' => $clientId !== null ? ['client_id' => $clientId] : null,
                ]);

                foreach ($stored as $attributes) {
                    $message->attachments()->create($attributes);
                }

                $this->writer->record($message);

                return $message;
            });
        } catch (Throwable $exception) {
            $this->deleteStored($stored);

            throw $exception;
        }

        // A retried send (same client_id) was already delivered the first
        // time — no second round of notifications or broadcasts.
        if (! $message->wasRecentlyCreated) {
            $this->deleteStored($stored);

            return $this->hydrator->hydrate($message);
        }

        $this->writer->announce($message, $user);
        $this->linkPreviews->schedule($message);

        return $message;
    }

    /**
     * The message this user already sent into this conversation under the
     * client-generated id — a retry after a dropped response, or a double
     * submit, gets that one back instead of a duplicate.
     */
    private function findByClientId(User $user, Conversation $conversation, string $clientId): ?Message
    {
        return Message::query()
            ->where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->where('meta->client_id', $clientId)
            ->first();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<int, array<string, mixed>>
     */
    private function storeAttachments(Conversation $conversation, array $data): array
    {
        $stored = [];

        try {
            foreach (array_values($data['attachments'] ?? []) as $index => $file) {
                $meta = $data['attachment_meta'][$index] ?? [];
                $voiceMime = StoreMessageRequest::voiceMimeType($file);
                $saved = $this->fileStorage->store($file, "chat/{$conversation->id}", 'public');
                $isVoice = array_key_exists('voice', $meta) && $meta['voice'] !== null
                    ? (bool) $meta['voice']
                    : ($voiceMime !== null && in_array(strtok($voiceMime, ';'), ['audio/webm', 'audio/ogg', 'audio/opus'], true));

                $stored[] = [
                    'disk' => $saved['disk'],
                    'path' => $saved['path'],
                    'original_name' => $saved['name'],
                    'mime_type' => $voiceMime ?? $saved['mime_type'],
                    'size' => $saved['size'],
                    'duration' => isset($meta['duration']) ? (int) $meta['duration'] : null,
                    'meta' => ['voice' => $isVoice],
                    ...($this->imageDimensions($file) ?? []),
                ];
            }
        } catch (Throwable $exception) {
            $this->deleteStored($stored);

            throw $exception;
        }

        return $stored;
    }

    /**
     * @param  array<int, array<string, mixed>>  $stored
     */
    private function deleteStored(array $stored): void
    {
        foreach ($stored as $attributes) {
            $this->fileStorage->delete((string) $attributes['path'], (string) $attributes['disk']);
        }
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
}
