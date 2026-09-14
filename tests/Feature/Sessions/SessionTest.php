<?php

use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSession;

function makeSession(User $user, array $attributes = []): UserSession
{
    $token = $user->createToken('test');

    return UserSession::create(array_merge([
        'user_id' => $user->id,
        'personal_access_token_id' => $token->accessToken->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'PestTestAgent/1.0',
        'device_name' => 'Test Device',
        'device_type' => 'desktop',
        'browser' => 'Chrome',
        'platform' => 'macOS',
        'logged_in_at' => now(),
        'last_activity_at' => now(),
    ], $attributes));
}

test('a user can list only their own sessions', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    makeSession($user);
    makeSession($user);
    makeSession($other);

    $response = $this->actingAs($user, 'sanctum')->getJson('/api/sessions');

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(2);
});

test('a user can view their own session detail', function () {
    $user = User::factory()->create();
    $session = makeSession($user);

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/sessions/{$session->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $session->id);
});

test('a user cannot view another user\'s session (IDOR protection)', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $session = makeSession($other);

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/sessions/{$session->id}")
        ->assertForbidden();
});

test('a user cannot revoke another user\'s session', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $session = makeSession($other);

    // The repository scopes the lookup to `where('user_id', $user->id)`,
    // so a foreign session id resolves as "not found" rather than 403.
    $this->actingAs($user, 'sanctum')
        ->deleteJson("/api/sessions/{$session->id}")
        ->assertNotFound();

    expect($session->fresh()->logged_out_at)->toBeNull();
});

test('a user cannot list another user\'s session request logs (IDOR protection)', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $session = makeSession($other);

    $this->actingAs($user, 'sanctum')
        ->getJson("/api/sessions/{$session->id}/request-logs")
        ->assertForbidden();
});

test('a user can revoke their own session', function () {
    $user = User::factory()->create();
    $session = makeSession($user);

    $this->actingAs($user, 'sanctum')
        ->deleteJson("/api/sessions/{$session->id}")
        ->assertOk();

    expect($session->fresh()->logged_out_at)->not->toBeNull();
});

test('a guest cannot access the sessions endpoint', function () {
    $this->getJson('/api/sessions')->assertUnauthorized();
});
