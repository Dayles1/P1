<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Chat\Events\MessageDeleted;
use App\Domain\Chat\Events\MessageRead;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\MessageRead as MessageReadRow;
use App\Domain\Identity\Models\User;
use App\Infrastructure\Storage\FileStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;

/**
 * `$count` messages from `$sender`, oldest first.
 *
 * @return array<int, int>
 */
function postMessages(User $sender, int $conversationId, int $count): array
{
    return array_map(fn (int $i) => sendChatMessage($sender, $conversationId, "m{$i}"), range(1, $count));
}

test('the window API answers from the start, from the end, after an id and around an id', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);
    $ids = postMessages($alice, $chat, 12);

    $start = $this->actingAs($bob, 'sanctum')->getJson("/api/conversations/{$chat}/messages?from=start&limit=5")->assertOk();
    expect(array_column($start->json('data'), 'id'))->toBe(array_slice($ids, 0, 5))
        ->and($start->json('meta.has_more_before'))->toBeFalse()
        ->and($start->json('meta.has_more_after'))->toBeTrue();

    $end = $this->actingAs($bob, 'sanctum')->getJson("/api/conversations/{$chat}/messages?limit=5")->assertOk();
    expect(array_column($end->json('data'), 'id'))->toBe(array_slice($ids, 7, 5));

    $after = $this->actingAs($bob, 'sanctum')->getJson("/api/conversations/{$chat}/messages?after_id={$ids[4]}&limit=3")->assertOk();
    expect(array_column($after->json('data'), 'id'))->toBe(array_slice($ids, 5, 3))
        ->and($after->json('meta.has_more_before'))->toBeTrue()
        ->and($after->json('meta.has_more_after'))->toBeTrue();

    $around = $this->actingAs($bob, 'sanctum')->getJson("/api/conversations/{$chat}/messages?around_id={$ids[6]}&limit=4")->assertOk();
    expect(array_column($around->json('data'), 'id'))->toBe(array_slice($ids, 4, 4));
});

test('the window meta says where the unread part starts', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);
    $ids = postMessages($alice, $chat, 4);

    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$chat}/read", ['message_id' => $ids[1]])->assertOk();

    $this->actingAs($bob, 'sanctum')->getJson("/api/conversations/{$chat}/messages")
        ->assertOk()
        ->assertJsonPath('meta.first_unread_id', $ids[2])
        ->assertJsonPath('meta.last_read_message_id', $ids[1])
        ->assertJsonPath('meta.unread_count', 2);
});

test('reading an older message keeps the newer ones unread', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);
    $ids = postMessages($alice, $chat, 5);

    $this->actingAs($bob, 'sanctum')
        ->postJson("/api/conversations/{$chat}/messages/{$ids[1]}/read")
        ->assertOk()
        ->assertJsonPath('data.unread_count', 3)
        ->assertJsonPath('data.last_read_message_id', $ids[1]);

    // Never backwards.
    $this->actingAs($bob, 'sanctum')
        ->postJson("/api/conversations/{$chat}/read", ['message_id' => $ids[0]])
        ->assertOk()
        ->assertJsonPath('data.last_read_message_id', $ids[1]);

    $this->actingAs($bob, 'sanctum')
        ->postJson("/api/conversations/{$chat}/read")
        ->assertOk()
        ->assertJsonPath('data.unread_count', 0)
        ->assertJsonPath('data.last_read_message_id', $ids[4]);
});

test('reading broadcasts message.read to every member, the reader included, with the reader\'s unread count', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);
    $ids = postMessages($alice, $chat, 3);

    Event::fake([MessageRead::class]);

    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$chat}/read", ['message_id' => $ids[1]])->assertOk();

    Event::assertDispatched(MessageRead::class, function (MessageRead $event) use ($alice, $bob, $ids, $chat) {
        $payload = $event->broadcastWith();
        $userIds = $event->userIds;
        sort($userIds);

        return $userIds === collect([$alice->id, $bob->id])->sort()->values()->all()
            && $payload['conversation_id'] === $chat
            && $payload['user_id'] === $bob->id
            && $payload['message_id'] === $ids[1]
            && $payload['unread_count'] === 1
            && is_string($payload['read_at_iso']);
    });
});

test('read receipts are written once, with the time, and counted from read pointers', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $carol = userWithRole(Role::USER);
    $group = startGroupConversation($alice, [$bob, $carol]);
    $messageId = sendChatMessage($alice, $group, 'hello all');

    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$group}/read")->assertOk();
    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$group}/read")->assertOk();

    expect(MessageReadRow::query()->where('message_id', $messageId)->where('user_id', $bob->id)->count())->toBe(1)
        ->and(MessageReadRow::query()->where('message_id', $messageId)->value('read_at'))->not->toBeNull();

    $message = collect($this->actingAs($alice, 'sanctum')->getJson("/api/conversations/{$group}/messages")->json('data'))
        ->firstWhere('id', $messageId);

    expect($message['read_count'])->toBe(1)
        ->and($message['is_read'])->toBeTrue()
        ->and($message)->not->toHaveKey('read_by');
});

test('the message resource has the full shape', function () {
    Storage::fake('public');
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);
    $parentId = sendChatMessage($bob, $chat, 'parent');

    $this->actingAs($alice, 'sanctum')->post("/api/conversations/{$chat}/messages", [
        'body' => 'with a voice note',
        'parent_message_id' => $parentId,
        'attachments' => [UploadedFile::fake()->create('voice.webm', 10, 'audio/webm')],
        'attachment_meta' => [['duration' => 7, 'voice' => '1']],
    ], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonStructure(['data' => [
            'id', 'conversation_id', 'client_id', 'type', 'body', 'sender' => ['id', 'name', 'avatar'], 'is_mine',
            'parent_message_id', 'reply_to' => ['id', 'type', 'body', 'sender_id', 'sender_name', 'attachment_kind'],
            'forwarded_from', 'attachments' => [['id', 'url', 'original_name', 'mime_type', 'size', 'width', 'height', 'duration', 'kind']],
            'reactions', 'read_count', 'is_read', 'is_pinned', 'pinned_at_iso', 'pinned_by', 'edit_count', 'edited_at_iso',
            'created_at_iso', 'created_at', 'edited_at', 'poll', 'system', 'link_preview',
        ]])
        ->assertJsonPath('data.type', 'text')
        ->assertJsonPath('data.attachments.0.kind', 'voice')
        ->assertJsonPath('data.attachments.0.duration', 7)
        ->assertJsonPath('data.reply_to.sender_id', $bob->id);
});

test('deleting the last message points the chat at the one before and fixes the unread count', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);
    [$first, $second] = postMessages($alice, $chat, 2);

    Event::fake([MessageDeleted::class]);

    $this->actingAs($alice, 'sanctum')->deleteJson("/api/conversations/{$chat}/messages/{$second}")
        ->assertOk()
        ->assertJsonPath('data.deleted_ids', [$second]);

    expect(Conversation::query()->find($chat)->last_message_id)->toBe($first)
        ->and(ConversationUser::query()->where('conversation_id', $chat)->where('user_id', $bob->id)->value('unread_count'))->toBe(1);

    $this->actingAs($bob, 'sanctum')->getJson('/api/conversations')
        ->assertJsonPath('data.0.last_message.id', $first)
        ->assertJsonPath('data.0.unread_count', 1);

    Event::assertDispatched(MessageDeleted::class, fn (MessageDeleted $event) => $event->messageIds === [$second]
        && $event->lastMessage['id'] === $first
        && count($event->userIds) === 2);
});

test('a send that fails leaves no file behind', function () {
    Storage::fake('public');
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);

    // The second file fails to store: the first one must be removed again.
    $this->mock(FileStorage::class, function ($mock) {
        $calls = 0;
        $mock->shouldReceive('store')->andReturnUsing(function (UploadedFile $file, string $directory, string $disk) use (&$calls) {
            if (++$calls === 2) {
                throw new RuntimeException('disk full');
            }

            Storage::disk($disk)->put("{$directory}/first.jpg", 'x');

            return ['path' => "{$directory}/first.jpg", 'disk' => $disk, 'name' => 'a.jpg', 'filename' => 'first.jpg', 'extension' => 'jpg', 'mime_type' => 'image/jpeg', 'size' => 1];
        });
        $mock->shouldReceive('delete')->andReturnUsing(fn (string $path, string $disk) => Storage::disk($disk)->delete($path));
    });

    $this->actingAs($alice, 'sanctum')->post("/api/conversations/{$chat}/messages", [
        'attachments' => [UploadedFile::fake()->image('a.jpg'), UploadedFile::fake()->image('b.jpg')],
    ], ['Accept' => 'application/json'])->assertServerError();

    expect(Storage::disk('public')->allFiles())->toBe([]);
});

test('an attachment-only message has a human preview in the chat list', function () {
    Storage::fake('public');
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);

    $this->actingAs($alice, 'sanctum')->postJson("/api/conversations/{$chat}/messages", [
        'attachments' => [UploadedFile::fake()->image('photo.jpg', 10, 10)],
    ])->assertCreated();

    $this->actingAs($bob, 'sanctum')->getJson('/api/conversations')
        ->assertJsonPath('data.0.last_message.preview', __('messages.chat.preview.photo'))
        ->assertJsonPath('data.0.last_message.attachment_kind', 'image');
});

test('mention tokens are shown as names in previews', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER, ['name' => 'Bob Stone']);
    $chat = startPrivateConversation($alice, $bob);

    sendChatMessage($alice, $chat, "hi @[Bob Stone]({$bob->id})!");

    $this->actingAs($bob, 'sanctum')->getJson('/api/conversations')
        ->assertJsonPath('data.0.last_message.preview', 'hi @Bob Stone!')
        ->assertJsonPath('data.0.unread_mentions_count', 1);
});
