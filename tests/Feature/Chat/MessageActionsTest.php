<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Chat\Events\ConversationActivity;
use App\Domain\Chat\Events\MessageDeleted;
use App\Domain\Chat\Events\MessageEdited;
use App\Domain\Chat\Events\MessageReactionToggled;
use App\Domain\Chat\Events\MessageRead;
use App\Domain\Chat\Events\MessageSent;
use App\Domain\Chat\Events\UserTyping;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

test('a user can edit their own message and it broadcasts', function () {
    Event::fake([MessageEdited::class]);
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $messageId = $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Original'])
        ->json('data.id');

    $this->actingAs($userA, 'sanctum')
        ->patchJson("/api/conversations/{$conversationId}/messages/{$messageId}", ['body' => 'Edited'])
        ->assertOk()
        ->assertJsonPath('data.body', 'Edited')
        ->assertJsonPath('data.edited_at', fn ($v) => $v !== null);

    Event::assertDispatched(MessageEdited::class);
});

test('a user cannot edit someone else\'s message without an explicit permission grant', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $messageId = $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Original'])
        ->json('data.id');

    $this->actingAs($userB, 'sanctum')
        ->patchJson("/api/conversations/{$conversationId}/messages/{$messageId}", ['body' => 'Hacked'])
        ->assertForbidden();
});

test('a user can delete their own message and it broadcasts', function () {
    Event::fake([MessageDeleted::class]);
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $messageId = $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Bye'])
        ->json('data.id');

    $this->actingAs($userA, 'sanctum')
        ->deleteJson("/api/conversations/{$conversationId}/messages/{$messageId}")
        ->assertOk();

    expect(Message::withTrashed()->find($messageId)->trashed())->toBeTrue();
    Event::assertDispatched(MessageDeleted::class);
});

test('toggling a reaction adds then removes it, and broadcasts each time', function () {
    Event::fake([MessageReactionToggled::class]);
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $messageId = $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'React to me'])
        ->json('data.id');

    $first = $this->actingAs($userB, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages/{$messageId}/reactions", ['emoji' => '👍'])
        ->assertOk();

    expect($first->json('data.reactions.0.count'))->toBe(1);
    expect($first->json('data.reactions.0.user_ids'))->toContain($userB->id);

    $second = $this->actingAs($userB, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages/{$messageId}/reactions", ['emoji' => '👍'])
        ->assertOk();

    expect($second->json('data.reactions'))->toBe([]);

    Event::assertDispatchedTimes(MessageReactionToggled::class, 2);
});

test('marking a message read updates the read receipt and broadcasts once', function () {
    Event::fake([MessageRead::class]);
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $messageId = $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Read me'])
        ->json('data.id');

    $this->actingAs($userB, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages/{$messageId}/read")
        ->assertOk();

    // Reading the same message twice must not double-broadcast.
    $this->actingAs($userB, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages/{$messageId}/read")
        ->assertOk();

    expect(App\Domain\Chat\Models\MessageRead::where('message_id', $messageId)->where('user_id', $userB->id)->count())->toBe(1);
    Event::assertDispatchedTimes(MessageRead::class, 1);
});

test('marking the newest message read also marks every earlier message in the conversation read', function () {
    Event::fake([MessageRead::class]);
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $firstId = $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'one'])
        ->json('data.id');
    $secondId = $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'two'])
        ->json('data.id');
    $thirdId = $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'three'])
        ->json('data.id');

    // userB only ever marks the newest message as read (matching what the
    // frontend actually does when opening a conversation or scrolling to
    // the bottom) — every earlier message must still end up read too.
    $this->actingAs($userB, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages/{$thirdId}/read")
        ->assertOk();

    foreach ([$firstId, $secondId, $thirdId] as $messageId) {
        expect(App\Domain\Chat\Models\MessageRead::where('message_id', $messageId)->where('user_id', $userB->id)->exists())
            ->toBeTrue("message {$messageId} should be marked read");
    }

    Event::assertDispatchedTimes(MessageRead::class, 1);
});

test('before_id pages through history as a stable cursor, oldest-safe and gap-free', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $ids = [];

    foreach (range(1, 25) as $i) {
        $ids[] = $this->actingAs($userA, 'sanctum')
            ->postJson("/api/conversations/{$conversationId}/messages", ['body' => "message {$i}"])
            ->json('data.id');
    }

    // Initial load: the newest 10, oldest first.
    $first = $this->actingAs($userB, 'sanctum')
        ->getJson("/api/conversations/{$conversationId}/messages?limit=10")
        ->assertOk()
        ->assertJsonPath('meta.has_more_before', true)
        ->assertJsonPath('meta.has_more_after', false);
    $firstIds = collect($first->json('data'))->pluck('id')->all();
    expect($firstIds)->toBe(array_slice($ids, 15, 10));

    // Page back further using the oldest id seen so far as the cursor.
    $second = $this->actingAs($userB, 'sanctum')
        ->getJson("/api/conversations/{$conversationId}/messages?limit=10&before_id={$firstIds[0]}")
        ->assertOk()
        ->assertJsonPath('meta.has_more_before', true)
        ->assertJsonPath('meta.has_more_after', true);
    $secondIds = collect($second->json('data'))->pluck('id')->all();
    expect($secondIds)->toBe(array_slice($ids, 5, 10));

    // No overlap, no gap between the two pages.
    expect(array_intersect($firstIds, $secondIds))->toBeEmpty();
    expect(min($firstIds) - max($secondIds))->toBe(1);
});

test('listing messages never moves the read pointer', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    foreach (range(1, 15) as $i) {
        $this->actingAs($userA, 'sanctum')->postJson("/api/conversations/{$conversationId}/messages", ['body' => "m{$i}"]);
    }

    $this->actingAs($userB, 'sanctum')
        ->getJson("/api/conversations/{$conversationId}/messages?limit=10")
        ->assertOk()
        ->assertJsonPath('meta.unread_count', 15)
        ->assertJsonPath('meta.last_read_message_id', null);

    $pivot = ConversationUser::where('conversation_id', $conversationId)
        ->where('user_id', $userB->id)
        ->first();

    expect($pivot->last_read_message_id)->toBeNull()
        ->and($pivot->unread_count)->toBe(15);
});

test('any member can pin and unpin a message', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $messageId = $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Pin me'])
        ->json('data.id');

    $this->actingAs($userB, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages/{$messageId}/pin")
        ->assertOk()
        ->assertJsonPath('data.is_pinned', true);

    $pinned = $this->actingAs($userA, 'sanctum')
        ->getJson("/api/conversations/{$conversationId}/messages/pinned")
        ->assertOk();

    expect($pinned->json('data'))->toHaveCount(1);

    $this->actingAs($userB, 'sanctum')
        ->deleteJson("/api/conversations/{$conversationId}/messages/{$messageId}/pin")
        ->assertOk()
        ->assertJsonPath('data.is_pinned', false);
});

test('the pinned list has every pinned message, newest pin first, with full message data', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $ids = collect(['first', 'second', 'third', 'unpinned'])->map(fn (string $body) => $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => $body])
        ->json('data.id'));

    $this->travelTo(now()->addMinute());
    $this->actingAs($userB, 'sanctum')->postJson("/api/conversations/{$conversationId}/messages/{$ids[1]}/pin")->assertOk();
    $this->travelTo(now()->addMinute());
    $this->actingAs($userB, 'sanctum')->postJson("/api/conversations/{$conversationId}/messages/{$ids[0]}/pin")->assertOk();
    $this->travelTo(now()->addMinute());
    $this->actingAs($userB, 'sanctum')->postJson("/api/conversations/{$conversationId}/messages/{$ids[2]}/pin")->assertOk();

    // Pinning again keeps the original pin time, so the order holds.
    $this->travelTo(now()->addMinute());
    $this->actingAs($userB, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages/{$ids[1]}/pin")
        ->assertOk()
        ->assertJsonPath('data.is_pinned', true);

    $pinned = $this->actingAs($userA, 'sanctum')
        ->getJson("/api/conversations/{$conversationId}/messages/pinned")
        ->assertOk()
        ->assertJsonStructure(['data' => [['id', 'sender', 'attachments', 'reactions', 'read_count', 'is_read', 'reply_to', 'client_id', 'pinned_by', 'pinned_at_iso']]]);

    expect(array_column($pinned->json('data'), 'id'))->toBe([$ids[2], $ids[0], $ids[1]]);
});

test('unpinning a message that is not pinned does not fail', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $messageId = $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Never pinned'])
        ->json('data.id');

    $this->actingAs($userA, 'sanctum')
        ->deleteJson("/api/conversations/{$conversationId}/messages/{$messageId}/pin")
        ->assertOk()
        ->assertJsonPath('data.is_pinned', false);
});

test('sending twice with the same client_id creates one message and returns it both times', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);
    $clientId = (string) Str::uuid();

    $first = $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Once', 'client_id' => $clientId])
        ->assertCreated()
        ->assertJsonPath('data.client_id', $clientId);

    Event::fake([MessageSent::class, ConversationActivity::class]);

    $second = $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Once', 'client_id' => $clientId])
        ->assertOk()
        ->assertJsonPath('data.client_id', $clientId);

    expect($second->json('data.id'))->toBe($first->json('data.id'))
        ->and(Message::query()->where('conversation_id', $conversationId)->count())->toBe(1)
        ->and($userB->notifications()->count())->toBe(1)
        ->and(ConversationUser::query()->where('conversation_id', $conversationId)->where('user_id', $userB->id)->value('unread_count'))->toBe(1);

    Event::assertNotDispatched(MessageSent::class);
    Event::assertNotDispatched(ConversationActivity::class);
});

test('the same client_id from another sender is a different message, and messages without one have a null client_id', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);
    $clientId = (string) Str::uuid();

    $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'A', 'client_id' => $clientId])
        ->assertCreated();

    forgetAuthGuards();

    $this->actingAs($userB, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'B', 'client_id' => $clientId])
        ->assertCreated();

    $this->actingAs($userB, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'No id'])
        ->assertCreated()
        ->assertJsonPath('data.client_id', null);

    expect(Message::query()->where('conversation_id', $conversationId)->count())->toBe(3);

    $this->actingAs($userB, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Bad', 'client_id' => str_repeat('a', 65)])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('client_id');
});

test('a voice message recorded in the browser is accepted as an attachment', function (string $name, string $mimeType) {
    Storage::fake('public');
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $this->actingAs($userA, 'sanctum')->postJson("/api/conversations/{$conversationId}/messages", [
        'attachments' => [UploadedFile::fake()->create($name, 20, $mimeType)],
    ])
        ->assertCreated()
        ->assertJsonPath('data.attachments.0.mime_type', $mimeType);
})->with([
    ['voice.webm', 'audio/webm'],
    ['voice.ogg', 'audio/ogg'],
    ['voice.mp3', 'audio/mpeg'],
    ['voice.m4a', 'audio/mp4'],
    ['voice.wav', 'audio/wav'],
]);

test('a browser voice recording that sniffs as video/webm is accepted and stored as audio', function () {
    Storage::fake('public');
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    // A real WebM header: finfo calls it video/webm, as it does for what
    // MediaRecorder records, while the browser sends it as audio/webm.
    $path = tempnam(sys_get_temp_dir(), 'voice');
    file_put_contents($path, "\x1A\x45\xDF\xA3\x9F\x42\x86\x81\x01\x42\xF7\x81\x01\x42\xF2\x81\x04\x42\xF3\x81\x08\x42\x82\x84webm\x42\x87\x81\x04\x42\x85\x81\x02".str_repeat("\0", 200));
    $voice = new UploadedFile($path, 'voice-1.webm', 'audio/webm', null, true);

    expect($voice->getMimeType())->toBe('video/webm');

    $this->actingAs($userA, 'sanctum')->post("/api/conversations/{$conversationId}/messages", [
        'client_id' => 'voice-test',
        'attachments' => [$voice],
    ], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('data.attachments.0.mime_type', 'audio/webm');
});

test('attachments outside the allowed types are still rejected', function () {
    Storage::fake('public');
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $this->actingAs($userA, 'sanctum')->postJson("/api/conversations/{$conversationId}/messages", [
        'attachments' => [UploadedFile::fake()->create('run.exe', 20, 'application/x-msdownload')],
    ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('attachments.0');
});

test('search finds messages within a conversation and across all of them', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $userC = userWithRole(Role::USER);

    $convoAB = startPrivateConversation($userA, $userB);
    $convoAC = startPrivateConversation($userA, $userC);

    $this->actingAs($userA, 'sanctum')->postJson("/api/conversations/{$convoAB}/messages", ['body' => 'find the treasure']);
    $this->actingAs($userA, 'sanctum')->postJson("/api/conversations/{$convoAC}/messages", ['body' => 'another treasure map']);
    $this->actingAs($userA, 'sanctum')->postJson("/api/conversations/{$convoAB}/messages", ['body' => 'unrelated text']);

    $global = $this->actingAs($userA, 'sanctum')->getJson('/api/messages/search?q=treasure')->assertOk();
    expect($global->json('data'))->toHaveCount(2);

    $scoped = $this->actingAs($userA, 'sanctum')
        ->getJson("/api/messages/search?q=treasure&conversation_id={$convoAB}")
        ->assertOk();
    expect($scoped->json('data'))->toHaveCount(1);

    // userC is not in convoAB, so their search never sees its messages.
    $outsiderSearch = $this->actingAs($userC, 'sanctum')->getJson('/api/messages/search?q=treasure')->assertOk();
    expect($outsiderSearch->json('data'))->toHaveCount(1);
});

test('sending a message with an attachment stores it and returns a url', function () {
    Storage::fake('public');
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $response = $this->actingAs($userA, 'sanctum')->postJson("/api/conversations/{$conversationId}/messages", [
        'attachments' => [UploadedFile::fake()->image('photo.jpg', 100, 80)],
    ])->assertCreated();

    expect($response->json('data.attachments'))->toHaveCount(1);
    expect($response->json('data.attachments.0.url'))->toStartWith('/storage/chat/');
    expect($response->json('data.attachments.0.width'))->toBe(100);
});

test('a message needs either a body or at least one attachment', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", [])
        ->assertUnprocessable();
});

test('mentioning a participant always creates a database notification, bypassing disabled preferences', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $timezone = timezoneRow('UTC');
    $userB->settings()->create([
        'timezone_id' => $timezone->id,
        'meta' => ['notifications' => ['database' => false, 'message' => false]],
    ]);

    $conversationId = startPrivateConversation($userA, $userB);

    $this->actingAs($userA, 'sanctum')->postJson("/api/conversations/{$conversationId}/messages", [
        'body' => "hey @[{$userB->name}]({$userB->id}) check this out",
    ])->assertCreated();

    $notification = $userB->notifications()->first();
    expect($notification)->not->toBeNull();
    expect($notification->data['type'])->toBe('mention');
});

test('a non-mentioned participant with messages disabled gets no notification', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $timezone = timezoneRow('UTC');
    $userB->settings()->create(['timezone_id' => $timezone->id, 'meta' => ['notifications' => ['message' => false]]]);

    $conversationId = startPrivateConversation($userA, $userB);

    $this->actingAs($userA, 'sanctum')->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'plain message']);

    expect($userB->notifications()->count())->toBe(0);
});

test('a muted conversation suppresses regular message notifications', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    ConversationUser::where('conversation_id', $conversationId)
        ->where('user_id', $userB->id)
        ->update(['muted_until' => now()->addDay()]);

    $this->actingAs($userA, 'sanctum')->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'quiet please']);

    expect($userB->notifications()->count())->toBe(0);
});

test('a regular message notification carries the message id, so a notification click can scroll straight to it', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $response = $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'hello there'])
        ->assertCreated();

    $notification = $userB->notifications()->first();

    expect($notification->data['type'])->toBe('message')
        ->and($notification->data['message_id'])->toBe($response->json('data.id'))
        ->and($notification->data['conversation_id'])->toBe($conversationId);
});

test('sending a message broadcasts MessageSent', function () {
    Event::fake([MessageSent::class]);
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $this->actingAs($userA, 'sanctum')->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'hi']);

    Event::assertDispatched(MessageSent::class);
});

test('the typing endpoint broadcasts without persisting anything', function () {
    Event::fake([UserTyping::class]);
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/typing")
        ->assertOk();

    Event::assertDispatched(UserTyping::class, fn ($event) => $event->conversationId === $conversationId && $event->userId === $userA->id);
});

test('a non-member cannot send typing events', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $outsider = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $this->actingAs($outsider, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/typing")
        ->assertNotFound();
});
