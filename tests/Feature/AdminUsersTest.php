<?php

use App\Domain\Ban\Actions\BanEntity;
use App\Domain\Identity\Models\User;

test('an admin can list users', function () {
    $admin = userWithRole('ADMIN');
    [$token] = createUserSession($admin);
    User::factory()->count(3)->create();

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/admin/users')
        ->assertOk()
        ->assertJsonCount(4, 'data'); // 3 + the admin itself
});

test('a non-admin cannot list users', function () {
    $user = User::factory()->create();
    [$token] = createUserSession($user);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/admin/users')
        ->assertForbidden();
});

test('an admin can change a regular user\'s role', function () {
    $admin = userWithRole('ADMIN');
    [$token] = createUserSession($admin);
    $target = userWithRole('USER');

    $this->withHeader('Authorization', "Bearer {$token}")
        ->patchJson("/api/admin/users/{$target->id}/role", ['role' => 'ADMIN'])
        ->assertOk()
        ->assertJsonPath('data.roles.0.code', 'ADMIN');
});

test('an admin cannot promote a user to super admin', function () {
    $admin = userWithRole('ADMIN');
    [$token] = createUserSession($admin);
    $target = userWithRole('USER');

    $this->withHeader('Authorization', "Bearer {$token}")
        ->patchJson("/api/admin/users/{$target->id}/role", ['role' => 'SUPER_ADMIN'])
        ->assertForbidden();
});

test('an admin cannot ban a super admin', function () {
    $admin = userWithRole('ADMIN');
    [$token] = createUserSession($admin);
    $superAdmin = userWithRole('SUPER_ADMIN');

    $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson("/api/admin/users/{$superAdmin->id}/ban", ['reason' => 'test'])
        ->assertForbidden();
});

test('a super admin can ban another super admin', function () {
    $actingSuperAdmin = userWithRole('SUPER_ADMIN');
    [$token] = createUserSession($actingSuperAdmin);
    $targetSuperAdmin = userWithRole('SUPER_ADMIN');

    $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson("/api/admin/users/{$targetSuperAdmin->id}/ban", ['reason' => 'test'])
        ->assertOk()
        ->assertJsonPath('data.is_banned', true);
});

test('banning a user immediately revokes their active tokens and sessions', function () {
    $admin = userWithRole('ADMIN');
    [$adminToken] = createUserSession($admin);

    $target = User::factory()->create();
    [$targetToken, $targetSession] = createUserSession($target);

    $this->withHeader('Authorization', "Bearer {$adminToken}")
        ->postJson("/api/admin/users/{$target->id}/ban", ['reason' => 'test'])
        ->assertOk();

    expect($target->tokens()->count())->toBe(0);
    expect($targetSession->fresh()->logged_out_at)->not->toBeNull();
});

test('a banned user is rejected on their very next authenticated request, not only at login', function () {
    $target = User::factory()->create();
    [$targetToken] = createUserSession($target);

    // Ban applied directly (bypassing the admin HTTP flow) to prove the
    // protection is a real request-level guard, not just something the
    // admin ban endpoint happens to do.
    app(BanEntity::class)->handle($target, reason: 'test');

    $this->withHeader('Authorization', "Bearer {$targetToken}")
        ->getJson('/api/profile')
        ->assertForbidden();
});

test('unbanning restores access', function () {
    $admin = userWithRole('ADMIN');
    [$token] = createUserSession($admin);
    $target = User::factory()->create();

    app(BanEntity::class)->handle($target, reason: 'test');

    $this->withHeader('Authorization', "Bearer {$token}")
        ->deleteJson("/api/admin/users/{$target->id}/ban")
        ->assertOk()
        ->assertJsonPath('data.is_banned', false);

    expect($target->fresh()->isBanned())->toBeFalse();
});
