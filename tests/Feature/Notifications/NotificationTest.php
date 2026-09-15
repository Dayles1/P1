<?php

use App\Domain\Identity\Models\User;
use App\Domain\Notification\Notifications\MentionNotification;
use App\Domain\Notification\Notifications\MessageNotification;
use App\Domain\Notification\Notifications\SystemNotification;

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
    $user->notify(new MessageNotification(1, 'General', 'Alex', 'hello'));

    $response = $this->withHeaders(['Authorization' => "Bearer {$token}"])
        ->getJson('/api/notifications?type=message')
        ->assertOk();

    $types = collect($response->json('data'))->pluck('type')->unique()->all();

    expect($types)->toBe(['message']);
});

test('a guest cannot access notifications', function () {
    $this->getJson('/api/notifications')->assertUnauthorized();
});
