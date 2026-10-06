<?php

use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserBlock;
use App\Domain\Notification\Notifications\AddedToConversationNotification;
use App\Domain\Notification\Notifications\MentionNotification;
use App\Domain\Notification\Notifications\MessageNotification;
use App\Domain\Notification\Notifications\MessagePinnedNotification;
use App\Domain\Notification\Notifications\ReactionNotification;
use App\Domain\Notification\Notifications\ReplyNotification;
use Illuminate\Http\UploadedFile;
use Illuminate\Notifications\ChannelManager;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Notification::fake();
});

function muteConversationFor(User $user, int $conversationId): void
{
    ConversationUser::query()
        ->where('conversation_id', $conversationId)
        ->where('user_id', $user->id)
        ->update(['notifications_enabled' => false]);
}

/** @param  array<string, bool>  $switches */
function withNotificationSwitches(User $user, array $switches): void
{
    $user->settings()->create([
        'timezone_id' => timezoneRow('UTC')->id,
        'meta' => ['notifications' => $switches],
    ]);
}

/** The `data` a notification of `$class` sent to `$user` carries (the last one). */
function sentData(User $user, string $class): array
{
    $sent = Notification::sent($user, $class);

    expect($sent)->not->toBeEmpty();

    return $sent->last()->toDatabase($user->fresh());
}

test('a message notification carries the actor, the sender and a readable preview', function () {
    [$alice, $bob] = User::factory()->count(2)->create();
    $conversationId = startPrivateConversation($alice, $bob);

    sendChatMessage($alice, $conversationId, 'Hi **there**');

    Notification::assertSentTo($bob, MessageNotification::class);
    Notification::assertNotSentTo($alice, MessageNotification::class);

    $data = sentData($bob, MessageNotification::class);

    expect($data)->toMatchArray([
        'type' => 'message',
        'conversation_id' => $conversationId,
        'conversation_type' => 'private',
        'title' => $alice->name,
        'sender_name' => $alice->name,
        'preview' => 'Hi there',
        'action_url' => "/chat/{$conversationId}",
    ])->and($data['actor'])->toMatchArray(['id' => $alice->id, 'name' => $alice->name]);
});

test('mention tokens read as @Name in the preview', function () {
    [$alice, $bob, $carol] = User::factory()->count(3)->create();
    $conversationId = startGroupConversation($alice, [$bob, $carol]);

    sendChatMessage($alice, $conversationId, "Look @[{$bob->name}]({$bob->id})");

    $mention = sentData($bob, MentionNotification::class);
    $message = sentData($carol, MessageNotification::class);

    expect($mention['preview'])->toBe("Look @{$bob->name}")
        ->and($mention['title'])->toBe('Team chat')
        ->and($message['preview'])->toBe("Look @{$bob->name}")
        ->and($message['body'])->not->toContain('](');
});

test('an attachment-only message gets a readable preview instead of an empty one', function () {
    Storage::fake('public');
    Storage::fake('local');

    [$alice, $bob] = User::factory()->count(2)->create();
    $conversationId = startPrivateConversation($alice, $bob);

    $this->actingAs($alice, 'sanctum')
        ->post("/api/conversations/{$conversationId}/messages", [
            'attachments' => [UploadedFile::fake()->image('photo.jpg', 20, 20)],
        ], ['Accept' => 'application/json'])
        ->assertCreated();

    $data = sentData($bob, MessageNotification::class);

    expect($data['preview'])->toBe(__('messages.chat.preview.photo'))
        ->and($data['body'])->toBe("{$alice->name}: ".__('messages.chat.preview.photo'));
});

test('a reply notifies the parent author with a reply instead of a message — even in a muted chat', function () {
    [$alice, $bob, $carol] = User::factory()->count(3)->create();
    $conversationId = startGroupConversation($alice, [$bob, $carol]);
    $parentId = sendChatMessage($bob, $conversationId, 'Question?');
    muteConversationFor($bob, $conversationId);
    Notification::fake();

    $replyId = sendChatMessage($alice, $conversationId, 'Answer', ['parent_message_id' => $parentId]);

    Notification::assertSentTo($bob, ReplyNotification::class);
    Notification::assertNotSentTo($bob, MessageNotification::class);
    Notification::assertSentTo($carol, MessageNotification::class);
    Notification::assertNotSentTo($carol, ReplyNotification::class);

    expect(sentData($bob, ReplyNotification::class))->toMatchArray([
        'type' => 'reply',
        'message_id' => $replyId,
        'sender_name' => $alice->name,
        'preview' => 'Answer',
    ]);
});

test('replying to your own message does not notify you', function () {
    [$alice, $bob] = User::factory()->count(2)->create();
    $conversationId = startPrivateConversation($alice, $bob);
    $parentId = sendChatMessage($alice, $conversationId, 'First');
    Notification::fake();

    sendChatMessage($alice, $conversationId, 'Second', ['parent_message_id' => $parentId]);

    Notification::assertNotSentTo($alice, ReplyNotification::class);
    Notification::assertSentTo($bob, MessageNotification::class);
});

test('a muted chat stays quiet for ordinary messages, but mentions still arrive', function () {
    [$alice, $bob] = User::factory()->count(2)->create();
    $conversationId = startGroupConversation($alice, [$bob]);
    muteConversationFor($bob, $conversationId);

    sendChatMessage($alice, $conversationId, 'Plain');
    Notification::assertNotSentTo($bob, MessageNotification::class);

    sendChatMessage($alice, $conversationId, "Hey @[{$bob->name}]({$bob->id})");
    Notification::assertSentTo($bob, MentionNotification::class);
});

test('nothing arrives from a sender the recipient blocked, not even a mention', function () {
    [$alice, $bob, $carol] = User::factory()->count(3)->create();
    $conversationId = startGroupConversation($alice, [$bob, $carol]);
    UserBlock::query()->create(['user_id' => $bob->id, 'blocked_user_id' => $alice->id]);

    sendChatMessage($alice, $conversationId, "Hey @[{$bob->name}]({$bob->id})");

    Notification::assertNotSentTo($bob, MentionNotification::class);
    Notification::assertNotSentTo($bob, MessageNotification::class);
    Notification::assertSentTo($carol, MessageNotification::class);
});

test('a reaction notifies the message author, not the reactor', function () {
    [$alice, $bob] = User::factory()->count(2)->create();
    $conversationId = startPrivateConversation($alice, $bob);
    $messageId = sendChatMessage($bob, $conversationId, 'Nice weather');
    Notification::fake();

    $this->actingAs($alice, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages/{$messageId}/reactions", ['emoji' => '👍'])
        ->assertOk();

    Notification::assertSentTo($bob, ReactionNotification::class);
    Notification::assertNotSentTo($alice, ReactionNotification::class);

    expect(sentData($bob, ReactionNotification::class))->toMatchArray([
        'type' => 'reaction',
        'conversation_id' => $conversationId,
        'message_id' => $messageId,
        'emoji' => '👍',
        'preview' => 'Nice weather',
        'sender_name' => $alice->name,
        'title' => $alice->name,
    ]);
});

test('reacting to your own message, or removing a reaction, notifies nobody', function () {
    [$alice, $bob] = User::factory()->count(2)->create();
    $conversationId = startPrivateConversation($alice, $bob);
    $own = sendChatMessage($alice, $conversationId, 'Mine');
    $theirs = sendChatMessage($bob, $conversationId, 'Theirs');
    $url = fn (int $id) => "/api/conversations/{$conversationId}/messages/{$id}/reactions";

    $this->actingAs($alice, 'sanctum')->postJson($url($own), ['emoji' => '👍'])->assertOk();
    $this->actingAs($alice, 'sanctum')->postJson($url($theirs), ['emoji' => '🔥'])->assertOk();
    Notification::fake();

    $this->actingAs($alice, 'sanctum')->postJson($url($theirs), ['emoji' => '🔥'])->assertOk();

    Notification::assertNothingSent();
});

test('a reaction respects mute and the reaction preference', function () {
    [$alice, $bob, $carol] = User::factory()->count(3)->create();
    $conversationId = startGroupConversation($alice, [$bob, $carol]);
    $bobMessage = sendChatMessage($bob, $conversationId, 'From Bob');
    $carolMessage = sendChatMessage($carol, $conversationId, 'From Carol');
    muteConversationFor($bob, $conversationId);
    withNotificationSwitches($carol, ['reaction' => false]);
    Notification::fake();

    $this->actingAs($alice, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages/{$bobMessage}/reactions", ['emoji' => '👍'])
        ->assertOk();
    $this->actingAs($alice, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages/{$carolMessage}/reactions", ['emoji' => '👍'])
        ->assertOk();

    Notification::assertNothingSent();
});

test('people added to a group are told, the one who added them is not', function () {
    [$alice, $bob, $carol] = User::factory()->count(3)->create();
    $conversationId = startGroupConversation($alice, [$bob], title: 'Design');

    Notification::assertSentTo($bob, AddedToConversationNotification::class);
    Notification::fake();

    $this->actingAs($alice, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/members", ['user_ids' => [$carol->id]])
        ->assertSuccessful();

    Notification::assertSentTo($carol, AddedToConversationNotification::class);
    Notification::assertNotSentTo($alice, AddedToConversationNotification::class);
    Notification::assertNotSentTo($bob, AddedToConversationNotification::class);

    expect(sentData($carol, AddedToConversationNotification::class))->toMatchArray([
        'type' => 'added_to_chat',
        'conversation_id' => $conversationId,
        'conversation_type' => 'group',
        'message_id' => null,
        'title' => 'Design',
        'sender_name' => $alice->name,
        'action_url' => "/chat/{$conversationId}",
    ]);
});

test('opening a private chat is not an added-to-chat notification', function () {
    [$alice, $bob] = User::factory()->count(2)->create();

    startPrivateConversation($alice, $bob);

    Notification::assertNotSentTo($bob, AddedToConversationNotification::class);
});

test('pinning a message tells the other members who have not muted the chat', function () {
    [$alice, $bob, $carol] = User::factory()->count(3)->create();
    $conversationId = startGroupConversation($alice, [$bob, $carol]);
    $messageId = sendChatMessage($bob, $conversationId, "Read @[{$carol->name}]({$carol->id})");
    muteConversationFor($carol, $conversationId);
    Notification::fake();

    $this->actingAs($alice, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages/{$messageId}/pin")
        ->assertOk();

    Notification::assertSentTo($bob, MessagePinnedNotification::class);
    Notification::assertNotSentTo($carol, MessagePinnedNotification::class);
    Notification::assertNotSentTo($alice, MessagePinnedNotification::class);
    // The service line the pin posts is not itself a notification.
    Notification::assertNotSentTo($bob, MessageNotification::class);

    expect(sentData($bob, MessagePinnedNotification::class))->toMatchArray([
        'type' => 'pinned',
        'message_id' => $messageId,
        'preview' => "Read @{$carol->name}",
        'sender_name' => $alice->name,
    ]);
});

test('system messages never notify', function () {
    [$alice, $bob, $carol] = User::factory()->count(3)->create();
    $conversationId = startGroupConversation($alice, [$bob]);
    Notification::fake();

    $this->actingAs($alice, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/members", ['user_ids' => [$carol->id]])
        ->assertSuccessful();

    Notification::assertNotSentTo($bob, MessageNotification::class);
    Notification::assertNotSentTo($carol, MessageNotification::class);
});

test('each chat type has its own switch, and mentions ignore every switch', function () {
    [$alice, $bob] = User::factory()->count(2)->create();
    withNotificationSwitches($bob, ['message' => false, 'reply' => false, 'added_to_chat' => false]);

    $conversationId = startGroupConversation($alice, [$bob]);
    $parentId = sendChatMessage($bob, $conversationId, 'Mine');
    sendChatMessage($alice, $conversationId, 'Plain');
    sendChatMessage($alice, $conversationId, 'Re', ['parent_message_id' => $parentId]);
    sendChatMessage($alice, $conversationId, "@[{$bob->name}]({$bob->id})");

    Notification::assertNotSentTo($bob, AddedToConversationNotification::class);
    Notification::assertNotSentTo($bob, MessageNotification::class);
    Notification::assertNotSentTo($bob, ReplyNotification::class);
    Notification::assertSentTo($bob, MentionNotification::class);
});

test('a notification stored for real lands in the database with its columns and payload', function () {
    Notification::swap(new ChannelManager(app()));

    [$alice, $bob] = User::factory()->count(2)->create();
    $conversationId = startPrivateConversation($alice, $bob);
    $messageId = sendChatMessage($bob, $conversationId, 'Hello');

    $this->actingAs($alice, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages/{$messageId}/reactions", ['emoji' => '❤️'])
        ->assertOk();

    $stored = $bob->notifications()->where('data->type', 'reaction')->first();

    expect($stored)->not->toBeNull()
        ->and($stored->conversation_id)->toBe($conversationId)
        ->and($stored->message_id)->toBe($messageId)
        ->and($stored->data['emoji'])->toBe('❤️');
});
