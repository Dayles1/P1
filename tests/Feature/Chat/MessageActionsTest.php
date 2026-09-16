<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Chat\Events\MessageDeleted;
use App\Domain\Chat\Events\MessageEdited;
use App\Domain\Chat\Events\MessageReactionToggled;
use App\Domain\Chat\Events\MessageRead;
use App\Domain\Chat\Events\MessageSent;
use App\Domain\Chat\Events\UserTyping;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Identity\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;

function startPrivateConversation(User $from, User $to): int
{
    return test()->actingAs($from, 'sanctum')->postJson('/api/conversations', [
        'type' => 'private',
        'user_ids' => [$to->id],
    ])->json('data.id');
}

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

    // Initial load: newest 10.
    $first = $this->actingAs($userB, 'sanctum')
        ->getJson("/api/conversations/{$conversationId}/messages?per_page=10")
        ->assertOk();
    $firstIds = collect($first->json('data'))->pluck('id')->all();
    expect($firstIds)->toBe(array_reverse(array_slice($ids, 15, 10)));

    // Page back further using the oldest id seen so far as the cursor.
    $oldestSoFar = min($firstIds);
    $second = $this->actingAs($userB, 'sanctum')
        ->getJson("/api/conversations/{$conversationId}/messages?per_page=10&before_id={$oldestSoFar}")
        ->assertOk();
    $secondIds = collect($second->json('data'))->pluck('id')->all();
    expect($secondIds)->toBe(array_reverse(array_slice($ids, 5, 10)));

    // No overlap, no gap between the two pages.
    expect(array_intersect($firstIds, $secondIds))->toBeEmpty();
    expect(min($firstIds) - max($secondIds))->toBe(1);
});

test('paging into older history does not move last_read_message_id backwards', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    foreach (range(1, 15) as $i) {
        $this->actingAs($userA, 'sanctum')->postJson("/api/conversations/{$conversationId}/messages", ['body' => "m{$i}"]);
    }

    // userB loads the newest page (marks the newest message read)...
    $newest = $this->actingAs($userB, 'sanctum')
        ->getJson("/api/conversations/{$conversationId}/messages?per_page=10")
        ->json('data');
    $newestId = collect($newest)->pluck('id')->max();

    // ...then scrolls up into older history.
    $oldestSoFar = collect($newest)->pluck('id')->min();
    $this->actingAs($userB, 'sanctum')
        ->getJson("/api/conversations/{$conversationId}/messages?per_page=10&before_id={$oldestSoFar}")
        ->assertOk();

    $pivot = ConversationUser::where('conversation_id', $conversationId)
        ->where('user_id', $userB->id)
        ->first();

    expect($pivot->last_read_message_id)->toBe($newestId);
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
