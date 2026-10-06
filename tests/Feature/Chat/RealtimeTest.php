<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Chat\Events\ConversationActivity;
use App\Domain\Chat\Events\ConversationRemoved;
use App\Domain\Chat\Events\ConversationSettingsChanged;
use App\Domain\Chat\Events\ConversationUpdated;
use App\Domain\Chat\Events\MessageDeleted;
use App\Domain\Chat\Events\MessageEdited;
use App\Domain\Chat\Events\MessageHidden;
use App\Domain\Chat\Events\MessageReactionToggled;
use App\Domain\Chat\Events\MessageRead;
use App\Domain\Chat\Events\MessageSent;
use App\Domain\Chat\Events\PollUpdated;
use App\Domain\Chat\Events\UserTyping;
use App\Domain\Notification\Events\NotificationsMarkedRead;
use Illuminate\Broadcasting\Broadcasters\Broadcaster;
use Illuminate\Broadcasting\BroadcastException;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

/**
 * Makes every broadcast fail, the way it does when Reverb is down.
 */
function breakBroadcasting(): void
{
    Broadcast::extend('failing', fn () => new class extends Broadcaster
    {
        public function auth($request)
        {
            return true;
        }

        public function validAuthenticationResponse($request, $result)
        {
            return $result;
        }

        public function broadcast(array $channels, $event, array $payload = []): void
        {
            throw new BroadcastException('Reverb is not running.');
        }
    });

    config([
        'broadcasting.connections.failing' => ['driver' => 'failing'],
        'broadcasting.default' => 'failing',
    ]);
}

test('every realtime event goes out in the request, never through the queue', function (string $event) {
    expect(is_subclass_of($event, ShouldBroadcastNow::class))->toBeTrue("{$event} waits for a queue worker");
})->with([
    MessageSent::class,
    MessageEdited::class,
    MessageDeleted::class,
    MessageReactionToggled::class,
    MessageRead::class,
    UserTyping::class,
    NotificationsMarkedRead::class,
    ConversationActivity::class,
    MessageHidden::class,
    PollUpdated::class,
    ConversationUpdated::class,
    ConversationSettingsChanged::class,
    ConversationRemoved::class,
]);

test('with a database queue and no worker, sending a message leaves nothing waiting in it', function () {
    config(['queue.default' => 'database']);

    $sender = userWithRole(Role::USER);
    $recipient = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($sender, $recipient);

    $this->actingAs($sender, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Hello'])
        ->assertSuccessful();

    $this->actingAs($recipient, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/typing")
        ->assertSuccessful();

    expect(DB::table('jobs')->count())->toBe(0);
});

test('a message is saved and returned even when Reverb is down', function () {
    $sender = userWithRole(Role::USER);
    $recipient = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($sender, $recipient);

    breakBroadcasting();

    $this->actingAs($sender, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Still sent'])
        ->assertSuccessful()
        ->assertJsonPath('data.body', 'Still sent');

    $this->actingAs($recipient, 'sanctum')
        ->getJson("/api/conversations/{$conversationId}/messages")
        ->assertOk()
        ->assertJsonPath('data.0.body', 'Still sent');
});

test('typing still answers when Reverb is down', function () {
    $sender = userWithRole(Role::USER);
    $recipient = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($sender, $recipient);

    breakBroadcasting();

    $this->actingAs($sender, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/typing")
        ->assertSuccessful();
});

test('a new message goes to every member on their own user channel, and no conversation channel', function () {
    $sender = userWithRole(Role::USER);
    $recipient = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($sender, $recipient);

    Event::fake([MessageSent::class, ConversationActivity::class]);

    $this->actingAs($sender, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Hi'])
        ->assertSuccessful();

    Event::assertDispatchedTimes(MessageSent::class, 1);
    Event::assertNotDispatched(ConversationActivity::class);
    Event::assertDispatched(MessageSent::class, function (MessageSent $event) use ($sender, $recipient, $conversationId) {
        $channels = array_map(fn ($channel) => $channel->name, $event->broadcastOn());
        sort($channels);
        $expected = ["private-App.Models.User.{$sender->id}", "private-App.Models.User.{$recipient->id}"];
        sort($expected);

        return $channels === $expected && $event->message->conversation_id === $conversationId;
    });
});

test('the message.sent payload is viewer-neutral: ISO times, no is_mine', function () {
    $sender = userWithRole(Role::USER);
    $recipient = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($sender, $recipient);

    Event::fake([MessageSent::class]);

    $this->actingAs($sender, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Hi'])
        ->assertSuccessful();

    Event::assertDispatched(MessageSent::class, function (MessageSent $event) use ($conversationId) {
        $payload = $event->broadcastWith();

        return $event->broadcastAs() === 'message.sent'
            && $payload['conversation_id'] === $conversationId
            && ! array_key_exists('is_mine', $payload['message'])
            && ! array_key_exists('created_at', $payload['message'])
            && is_string($payload['message']['created_at_iso'])
            && $payload['message']['body'] === 'Hi';
    });
});

test('a group message is one broadcast addressed to every member', function () {
    $sender = userWithRole(Role::USER);
    $memberA = userWithRole(Role::USER);
    $memberB = userWithRole(Role::USER);

    $conversationId = $this->actingAs($sender, 'sanctum')->postJson('/api/conversations', [
        'type' => 'group',
        'title' => 'Launch',
        'user_ids' => [$memberA->id, $memberB->id],
    ])->json('data.id');

    Event::fake([MessageSent::class]);

    $this->actingAs($sender, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Hi all'])
        ->assertSuccessful();

    Event::assertDispatchedTimes(MessageSent::class, 1);
    Event::assertDispatched(MessageSent::class, fn (MessageSent $event) => count($event->broadcastOn()) === 3);
});

test('a removed member stops receiving the group events at once', function () {
    $creator = userWithRole(Role::USER);
    $member = userWithRole(Role::USER);
    $other = userWithRole(Role::USER);

    $conversationId = $this->actingAs($creator, 'sanctum')->postJson('/api/conversations', [
        'type' => 'group',
        'title' => 'Launch',
        'user_ids' => [$member->id, $other->id],
    ])->json('data.id');

    $this->actingAs($creator, 'sanctum')
        ->deleteJson("/api/conversations/{$conversationId}/members", ['user_ids' => [$member->id]])
        ->assertOk();

    Event::fake([MessageSent::class]);

    $this->actingAs($creator, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'After'])
        ->assertSuccessful();

    Event::assertDispatched(MessageSent::class, fn (MessageSent $event) => ! in_array($member->id, $event->userIds, true)
        && in_array($other->id, $event->userIds, true));
});

test('an activity event with nobody to tell does not broadcast', function () {
    $event = new ConversationActivity([], 1, ConversationActivity::REASON_MESSAGE);

    expect($event->broadcastWhen())->toBeFalse()
        ->and($event->broadcastOn())->toBe([])
        ->and($event->broadcastAs())->toBe('conversation.activity')
        ->and($event->broadcastWith())->toBe(['conversation_id' => 1, 'reason' => ConversationActivity::REASON_MESSAGE]);
});

test('the people a conversation is started with hear about it at once', function () {
    $creator = userWithRole(Role::USER);
    $memberA = userWithRole(Role::USER);
    $memberB = userWithRole(Role::USER);

    Event::fake([ConversationActivity::class]);

    $conversationId = $this->actingAs($creator, 'sanctum')->postJson('/api/conversations', [
        'type' => 'group',
        'title' => 'Launch',
        'user_ids' => [$memberA->id, $memberB->id],
    ])->assertOk()->json('data.id');

    Event::assertDispatchedTimes(ConversationActivity::class, 1);
    Event::assertDispatched(ConversationActivity::class, fn (ConversationActivity $event) => $event->userIds === [$memberA->id, $memberB->id]
        && $event->conversationId === $conversationId
        && $event->reason === ConversationActivity::REASON_JOINED);
});

test('members added to a group hear about it in one broadcast', function () {
    $creator = userWithRole(Role::USER);
    $memberA = userWithRole(Role::USER);
    $memberB = userWithRole(Role::USER);

    $conversationId = $this->actingAs($creator, 'sanctum')->postJson('/api/conversations', [
        'type' => 'group',
        'title' => 'Launch',
        'user_ids' => [userWithRole(Role::USER)->id],
    ])->json('data.id');

    Event::fake([ConversationActivity::class]);

    $this->actingAs($creator, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/members", ['user_ids' => [$memberA->id, $memberB->id]])
        ->assertSuccessful();

    Event::assertDispatchedTimes(ConversationActivity::class, 1);
    Event::assertDispatched(ConversationActivity::class, fn (ConversationActivity $event) => $event->userIds === [$memberA->id, $memberB->id]
        && $event->reason === ConversationActivity::REASON_JOINED);
});

test('pinning and unpinning a message is broadcast to the conversation', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $conversationId = startPrivateConversation($userA, $userB);

    $messageId = $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Pin me'])
        ->json('data.id');

    Event::fake([MessageEdited::class]);

    $this->actingAs($userB, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages/{$messageId}/pin")
        ->assertOk();

    $this->actingAs($userB, 'sanctum')
        ->deleteJson("/api/conversations/{$conversationId}/messages/{$messageId}/pin")
        ->assertOk();

    Event::assertDispatchedTimes(MessageEdited::class, 2);
    Event::assertDispatched(MessageEdited::class, fn (MessageEdited $event) => $event->message->id === $messageId);
});
