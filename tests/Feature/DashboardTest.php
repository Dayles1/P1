<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Identity\Models\RequestLog;
use App\Domain\Identity\Models\User;
use App\Domain\Notification\Notifications\SystemNotification;

test('the dashboard summary reflects real database state, not placeholders', function () {
    $user = User::factory()->create();
    [$token, $session] = createUserSession($user);

    RequestLog::factory()->count(2)->create([
        'user_id' => $user->id,
        'user_session_id' => $session->id,
        'created_at' => now(),
    ]);

    RequestLog::factory()->create([
        'user_id' => $user->id,
        'user_session_id' => $session->id,
        'status_code' => 500,
        'created_at' => now(),
    ]);

    $response = $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/dashboard');

    $response->assertOk();
    expect($response->json('data.sessions.active'))->toBe(1);
    expect($response->json('data.requests.today'))->toBe(3);
    expect($response->json('data.requests.errors_this_week'))->toBe(1);
    expect($response->json('data.instance'))->toBeNull();
});

test('the dashboard reflects real unread notifications and recent conversations', function () {
    $userA = User::factory()->create();
    $userB = userWithRole(Role::USER);
    [$token] = createUserSession($userA);

    $userA->notify(new SystemNotification('Hi', 'Body'));

    $conversationId = $this->actingAs($userA, 'sanctum')->postJson('/api/conversations', [
        'type' => 'private',
        'user_ids' => [$userB->id],
    ])->json('data.id');

    $this->actingAs($userA, 'sanctum')->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'hey']);

    $response = $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/dashboard');

    $response->assertOk();
    expect($response->json('data.unread_notifications'))->toBe(1);
    expect($response->json('data.recent_conversations'))->toHaveCount(1);
    expect($response->json('data.recent_conversations.0.id'))->toBe($conversationId);
});

test('the dashboard includes an instance overview only for admins', function () {
    $admin = userWithRole('ADMIN');
    [$token] = createUserSession($admin);

    $response = $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/dashboard');

    $response->assertOk();
    expect($response->json('data.instance.total_users'))->toBe(1);
});

test('the figures of the last day compare with the day before and name the most common error', function () {
    $user = User::factory()->create();
    [$token, $session] = createUserSession($user);

    $log = fn (array $attributes) => RequestLog::factory()->create([
        'user_id' => $user->id,
        'user_session_id' => $session->id,
        ...$attributes,
    ]);

    $log(['created_at' => now()->subHours(30), 'status_code' => 200]);
    $log(['created_at' => now()->subHour(), 'status_code' => 200]);
    $log(['created_at' => now()->subHour(), 'status_code' => 422]);
    $log(['created_at' => now()->subHour(), 'status_code' => 422]);
    $log(['created_at' => now()->subHour(), 'status_code' => 404]);

    $response = $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/dashboard')->assertOk();

    expect($response->json('data.requests.last_24h'))->toBe(4)
        ->and($response->json('data.requests.previous_24h'))->toBe(1)
        ->and($response->json('data.requests.errors_24h'))->toBe(3)
        ->and($response->json('data.requests.top_error_status'))->toBe(422)
        ->and($response->json('data.sessions.new_this_week'))->toBe(1)
        ->and($response->json('data.sessions.devices'))->toBe(1)
        ->and($response->json('data.account.has_two_factor'))->toBeFalse();
});

test('the chats figure counts conversations and those with something unread', function () {
    $userA = User::factory()->create();
    $userB = userWithRole(Role::USER);

    $conversationId = startPrivateConversation($userA, $userB);
    $this->actingAs($userB, 'sanctum')->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'hey']);

    $response = $this->actingAs($userA, 'sanctum')->getJson('/api/dashboard')->assertOk();

    expect($response->json('data.conversations.total'))->toBe(1)
        ->and($response->json('data.conversations.with_unread'))->toBe(1);
});

test('the instance overview carries the queue, the version and the state of each service', function () {
    $admin = userWithRole('ADMIN');
    [$token] = createUserSession($admin);

    $response = $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/dashboard')->assertOk();
    $release = (require base_path('resources/data/changelog.php'))[0];

    expect($response->json('data.instance.active_today'))->toBeInt()
        ->and($response->json('data.instance.requests_peak_per_minute'))->toBeInt()
        ->and($response->json('data.instance.queue_pending'))->toBe(0)
        ->and($response->json('data.instance.version'))->toBe($release['version'])
        ->and(array_keys($response->json('data.instance.services')))->toBe(['reverb', 'queue', 'mail', 'database'])
        ->and($response->json('data.instance.services.reverb'))->toBeFalse();
});
