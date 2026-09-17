<?php

use App\Domain\Identity\Models\User;
use App\Domain\Notification\Events\NotificationsMarkedRead;
use App\Domain\Notification\Notifications\MentionNotification;
use App\Domain\Notification\Notifications\MessageNotification;
use App\Domain\Notification\Notifications\SystemNotification;
use Illuminate\Support\Facades\Event;

test('a system notification is stored and listed for its recipient', function () {
    $user = User::factory()->create();
    [$token] = createUserSession($user);

    $user->notify(new SystemNotification('Maintenance', 'The app will be down briefly tonight.'));

    $response = $this->withHeaders(['Authorization' => "Bearer {$token}"])
        ->getJson('/api/notifications')
        ->assertOk();

    $response->assertJsonFragment(['type' => 'system', 'title' => 'Maintenance']);
});

test('unread count reflects only unread notifications', function () {
    $user = User::factory()->create();
    [$token] = createUserSession($user);

    $user->notify(new SystemNotification('One', 'Body'));
    $user->notify(new SystemNotification('Two', 'Body'));

    $headers = ['Authorization' => "Bearer {$token}"];

    $this->withHeaders($headers)->getJson('/api/notifications/unread-count')
        ->assertOk()
        ->assertJsonPath('data.count', 2);

    $notificationId = $user->notifications()->first()->id;

    $this->withHeaders($headers)->postJson("/api/notifications/{$notificationId}/read")->assertOk();

    $this->withHeaders($headers)->getJson('/api/notifications/unread-count')
        ->assertOk()
        ->assertJsonPath('data.count', 1);
});

test('mark-all-as-read clears every unread notification', function () {
    $user = User::factory()->create();
    [$token] = createUserSession($user);

    $user->notify(new SystemNotification('One', 'Body'));
    $user->notify(new SystemNotification('Two', 'Body'));

    $headers = ['Authorization' => "Bearer {$token}"];

    $this->withHeaders($headers)->postJson('/api/notifications/read-all')->assertOk();

    $this->withHeaders($headers)->getJson('/api/notifications/unread-count')
        ->assertOk()
        ->assertJsonPath('data.count', 0);
});

test('a system notification is not stored when the recipient disabled that type', function () {
    $user = User::factory()->create();
    $timezone = timezoneRow('UTC');
    $user->settings()->create(['timezone_id' => $timezone->id, 'meta' => ['notifications' => ['system' => false]]]);

    $user->notify(new SystemNotification('Maintenance', 'Body'));

    expect($user->notifications()->count())->toBe(0);
});

test('a system notification is not stored when the recipient disabled database notifications entirely', function () {
    $user = User::factory()->create();
    $timezone = timezoneRow('UTC');
    $user->settings()->create(['timezone_id' => $timezone->id, 'meta' => ['notifications' => ['database' => false]]]);

    $user->notify(new SystemNotification('Maintenance', 'Body'));

    expect($user->notifications()->count())->toBe(0);
});

test('a mention notification is always stored even when the recipient disabled every preference', function () {
    $user = User::factory()->create();
    $timezone = timezoneRow('UTC');
    $user->settings()->create([
        'timezone_id' => $timezone->id,
        'meta' => ['notifications' => ['database' => false, 'message' => false, 'system' => false, 'browser' => false]],
    ]);

    $user->notify(new MentionNotification(
        conversationId: 1,
        messageId: 1,
        conversationTitle: 'Team chat',
        senderName: 'Alex',
        preview: 'hey @you check this out',
    ));

    expect($user->notifications()->count())->toBe(1);
    expect($user->notifications()->first()->data['type'])->toBe('mention');
});

test('the type filter only returns notifications of that type', function () {
    $user = User::factory()->create();
    [$token] = createUserSession($user);

    $user->notify(new SystemNotification('Sys', 'Body'));
    $user->notify(new MessageNotification(1, 1, 'General', 'Alex', 'hello'));

    $response = $this->withHeaders(['Authorization' => "Bearer {$token}"])
        ->getJson('/api/notifications?type=message')
        ->assertOk();

    $types = collect($response->json('data'))->pluck('type')->unique()->all();

    expect($types)->toBe(['message']);
});

test('a guest cannot access notifications', function () {
    $this->getJson('/api/notifications')->assertUnauthorized();
});

test('notifications that persist to the database also broadcast in realtime', function () {
    $user = User::factory()->create();
    $timezone = timezoneRow('UTC');
    $user->settings()->create(['timezone_id' => $timezone->id]);

    expect((new SystemNotification('Maintenance', 'Body'))->via($user))->toBe(['database', 'broadcast']);
});

test('a disabled preference also skips the broadcast channel, not just the database one', function () {
    $user = User::factory()->create();
    $timezone = timezoneRow('UTC');
    $user->settings()->create(['timezone_id' => $timezone->id, 'meta' => ['notifications' => ['system' => false]]]);

    expect((new SystemNotification('Maintenance', 'Body'))->via($user))->toBe([]);
});

test('mentions always broadcast too, regardless of preferences', function () {
    $user = User::factory()->create();
    $timezone = timezoneRow('UTC');
    $user->settings()->create(['timezone_id' => $timezone->id, 'meta' => ['notifications' => ['database' => false]]]);

    $notification = new MentionNotification(1, 1, 'Team chat', 'Alex', 'hey');

    expect($notification->via($user))->toBe(['database', 'broadcast']);
});

test('users broadcast notifications on the already-authorized App.Models.User channel', function () {
    $user = User::factory()->create();

    expect($user->receivesBroadcastNotificationsOn())->toBe("App.Models.User.{$user->id}");
});

test('mention/message notifications store conversation_id and message_id as real columns, not just inside data', function () {
    $user = User::factory()->create();

    $user->notify(new MessageNotification(
        conversationId: 42,
        messageId: 99,
        conversationTitle: 'General',
        senderName: 'Alex',
        preview: 'hi',
    ));

    $notification = $user->notifications()->first();

    expect($notification->conversation_id)->toBe(42)
        ->and($notification->message_id)->toBe(99);
});

test('reading a message in Chat marks its matching notification as read and broadcasts the change', function () {
    Event::fake([NotificationsMarkedRead::class]);

    $sender = User::factory()->create();
    $recipient = User::factory()->create();

    $conversationId = $this->actingAs($sender, 'sanctum')->postJson('/api/conversations', [
        'type' => 'private',
        'user_ids' => [$recipient->id],
    ])->json('data.id');

    $messageId = $this->actingAs($sender, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Hello there'])
        ->json('data.id');

    expect($recipient->notifications()->count())->toBe(1);
    expect($recipient->fresh()->unreadNotifications()->count())->toBe(1);

    $this->actingAs($recipient, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages/{$messageId}/read")
        ->assertOk();

    expect($recipient->fresh()->unreadNotifications()->count())->toBe(0);

    Event::assertDispatched(NotificationsMarkedRead::class, function (NotificationsMarkedRead $event) use ($recipient) {
        return $event->userId === $recipient->id && $event->unreadCount === 0;
    });
});

test('marking a single notification read broadcasts NotificationsMarkedRead with the fresh unread count', function () {
    Event::fake([NotificationsMarkedRead::class]);

    $user = User::factory()->create();
    [$token] = createUserSession($user);

    $user->notify(new SystemNotification('One', 'Body'));
    $user->notify(new SystemNotification('Two', 'Body'));

    $notificationId = $user->notifications()->first()->id;

    $this->withHeaders(['Authorization' => "Bearer {$token}"])
        ->postJson("/api/notifications/{$notificationId}/read")
        ->assertOk();

    Event::assertDispatched(NotificationsMarkedRead::class, function (NotificationsMarkedRead $event) use ($user, $notificationId) {
        return $event->userId === $user->id
            && $event->notificationIds === [$notificationId]
            && $event->unreadCount === 1;
    });
});

test('mark-all-as-read broadcasts NotificationsMarkedRead with unread_count zero', function () {
    Event::fake([NotificationsMarkedRead::class]);

    $user = User::factory()->create();
    [$token] = createUserSession($user);

    $user->notify(new SystemNotification('One', 'Body'));
    $user->notify(new SystemNotification('Two', 'Body'));

    $this->withHeaders(['Authorization' => "Bearer {$token}"])
        ->postJson('/api/notifications/read-all')
        ->assertOk();

    Event::assertDispatched(NotificationsMarkedRead::class, function (NotificationsMarkedRead $event) use ($user) {
        return $event->userId === $user->id && $event->unreadCount === 0 && count($event->notificationIds) === 2;
    });
});

test('the broadcast payload carries the type via broadcastType, not a colliding data key', function () {
    $user = User::factory()->create();
    $notification = new MessageNotification(5, 9, 'General', 'Alex', 'hi there');

    $broadcastData = $notification->toBroadcast($user)->data;

    expect($broadcastData)->not->toHaveKey('type')
        ->and($broadcastData['conversation_id'])->toBe(5)
        ->and($broadcastData['message_id'])->toBe(9)
        ->and($notification->broadcastType())->toBe('message');
});
