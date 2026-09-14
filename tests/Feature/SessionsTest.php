<?php

use App\Domain\Identity\Models\User;

test('a user can list their own sessions with pagination meta', function () {
    $user = User::factory()->create();
    [$token] = createUserSession($user);

    $response = $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/sessions');

    $response->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonStructure(['data', 'pagination' => ['current_page', 'last_page', 'per_page', 'total']]);

    expect($response->json('data'))->toHaveCount(1);
    expect($response->json('data.0.is_current'))->toBeTrue();
});

test('a user can view the detail of their own session', function () {
    $user = User::factory()->create();
    [$token, $session] = createUserSession($user);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson("/api/sessions/{$session->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $session->id);
});

test('a user cannot view another user\'s session (IDOR protection)', function () {
    $owner = User::factory()->create();
    [, $session] = createUserSession($owner);

    $attacker = User::factory()->create();
    [$attackerToken] = createUserSession($attacker);

    $this->withHeader('Authorization', "Bearer {$attackerToken}")
        ->getJson("/api/sessions/{$session->id}")
        ->assertForbidden();
});

test('a user cannot revoke another user\'s session', function () {
    $owner = User::factory()->create();
    [, $session] = createUserSession($owner);

    $attacker = User::factory()->create();
    [$attackerToken] = createUserSession($attacker);

    $this->withHeader('Authorization', "Bearer {$attackerToken}")
        ->deleteJson("/api/sessions/{$session->id}")
        ->assertNotFound(); // revoke() scopes the lookup by user_id, so a foreign id 404s

    // The owner's session must still be active — the attacker's call had no effect.
    expect($session->fresh()->logged_out_at)->toBeNull();
});

test('a user can revoke one of their own sessions', function () {
    $user = User::factory()->create();
    [$token, $session] = createUserSession($user);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->deleteJson("/api/sessions/{$session->id}")
        ->assertOk();

    expect($session->fresh()->logged_out_at)->not->toBeNull();
});

test('revoking other sessions leaves the current one active', function () {
    $user = User::factory()->create();
    [$currentToken, $currentSession] = createUserSession($user);
    [, $otherSession] = createUserSession($user);

    $this->withHeader('Authorization', "Bearer {$currentToken}")
        ->deleteJson('/api/sessions/others')
        ->assertOk()
        ->assertJsonPath('data.revoked_sessions', 1);

    expect($currentSession->fresh()->logged_out_at)->toBeNull();
    expect($otherSession->fresh()->logged_out_at)->not->toBeNull();
});
