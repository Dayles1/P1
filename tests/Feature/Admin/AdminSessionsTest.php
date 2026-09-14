<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSession;

function adminMakeSession(User $user): UserSession
{
    $token = $user->createToken('test');

    return UserSession::create([
        'user_id' => $user->id,
        'personal_access_token_id' => $token->accessToken->id,
        'ip_address' => '10.0.0.1',
        'device_name' => 'Admin Test Device',
        'browser' => 'Firefox',
        'platform' => 'Linux',
        'logged_in_at' => now(),
        'last_activity_at' => now(),
    ]);
}

test('a regular user cannot list admin sessions', function () {
    $user = userWithRole(Role::USER);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/admin/sessions')
        ->assertForbidden();
});

test('an admin can list every user\'s sessions', function () {
    $admin = userWithRole(Role::ADMIN);
    $someone = userWithRole(Role::USER);

    adminMakeSession($someone);
    adminMakeSession($admin);

    $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/sessions');

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(2);
});

test('an admin can revoke any user\'s session', function () {
    $admin = userWithRole(Role::ADMIN);
    $someone = userWithRole(Role::USER);
    $session = adminMakeSession($someone);

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/admin/sessions/{$session->id}")
        ->assertOk();

    expect($session->fresh()->logged_out_at)->not->toBeNull();
});

test('an admin can view another user\'s session request logs', function () {
    $admin = userWithRole(Role::ADMIN);
    $someone = userWithRole(Role::USER);
    $session = adminMakeSession($someone);

    $this->actingAs($admin, 'sanctum')
        ->getJson("/api/admin/sessions/{$session->id}/request-logs")
        ->assertOk();
});
