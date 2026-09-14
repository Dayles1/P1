<?php

use App\Domain\Identity\Models\RequestLog;
use App\Domain\Identity\Models\User;

test('a real request through the app is captured in request_logs with sensitive fields redacted', function () {
    $user = User::factory()->create(['password' => bcrypt('Password123')]);

    $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'Password123',
    ])->assertOk();

    $log = RequestLog::where('path', '/api/auth/login')->latest('id')->first();

    expect($log)->not->toBeNull();
    expect($log->method)->toBe('POST');
    expect($log->status_code)->toBe(200);
    expect($log->body['password'])->toBe('[REDACTED]');
    expect($log->response_body['data']['token'])->toBe('[REDACTED]');
});

test('a user can list request logs for their own session', function () {
    $user = User::factory()->create();
    [$token, $session] = createUserSession($user);

    RequestLog::factory()->count(3)->create(['user_session_id' => $session->id, 'user_id' => $user->id]);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson("/api/sessions/{$session->id}/request-logs")
        ->assertOk()
        ->assertJsonCount(3, 'data');
});

test('a user can view the full detail of one of their own request logs', function () {
    $user = User::factory()->create();
    [$token, $session] = createUserSession($user);

    $log = RequestLog::factory()->create([
        'user_session_id' => $session->id,
        'user_id' => $user->id,
        'body' => ['foo' => 'bar'],
    ]);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson("/api/sessions/{$session->id}/request-logs/{$log->id}")
        ->assertOk()
        ->assertJsonPath('data.body.foo', 'bar');
});

test('a user cannot list request logs of another user\'s session', function () {
    $owner = User::factory()->create();
    [, $session] = createUserSession($owner);

    $attacker = User::factory()->create();
    [$attackerToken] = createUserSession($attacker);

    $this->withHeader('Authorization', "Bearer {$attackerToken}")
        ->getJson("/api/sessions/{$session->id}/request-logs")
        ->assertForbidden();
});

test('a user cannot view a request log that belongs to a different session even if they own another session', function () {
    $user = User::factory()->create();
    [$token, $ownSession] = createUserSession($user);
    [, $otherUsersSession] = createUserSession(User::factory()->create());

    $foreignLog = RequestLog::factory()->create(['user_session_id' => $otherUsersSession->id]);

    // Mismatched session/log pairing must 404, not leak the foreign log.
    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson("/api/sessions/{$ownSession->id}/request-logs/{$foreignLog->id}")
        ->assertNotFound();
});

test('an admin can view request logs for any session', function () {
    $admin = userWithRole('ADMIN');
    [$adminToken] = createUserSession($admin);

    $user = User::factory()->create();
    [, $session] = createUserSession($user);
    RequestLog::factory()->create(['user_session_id' => $session->id]);

    $this->withHeader('Authorization', "Bearer {$adminToken}")
        ->getJson("/api/admin/sessions/{$session->id}/request-logs")
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

test('a non-admin cannot access the admin request-logs endpoint', function () {
    $user = User::factory()->create();
    [$token] = createUserSession($user);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/admin/request-logs')
        ->assertForbidden();
});
