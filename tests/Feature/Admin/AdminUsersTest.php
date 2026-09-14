<?php

use App\Domain\AccessControl\Models\Role;

test('a regular user cannot access the admin users endpoint', function () {
    $user = userWithRole(Role::USER);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/admin/users')
        ->assertForbidden();
});

test('an admin can list, ban, and unban a user', function () {
    $admin = userWithRole(Role::ADMIN);
    $target = userWithRole(Role::USER);

    $this->actingAs($admin, 'sanctum')
        ->getJson('/api/admin/users')
        ->assertOk();

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/admin/users/{$target->id}/ban", ['reason' => 'testing'])
        ->assertOk()
        ->assertJsonPath('data.is_banned', true);

    expect($target->fresh()->isBanned())->toBeTrue();

    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/admin/users/{$target->id}/ban")
        ->assertOk()
        ->assertJsonPath('data.is_banned', false);

    expect($target->fresh()->isBanned())->toBeFalse();
});

test('an admin can change a regular user\'s role', function () {
    $admin = userWithRole(Role::ADMIN);
    $target = userWithRole(Role::USER);

    $this->actingAs($admin, 'sanctum')
        ->patchJson("/api/admin/users/{$target->id}/role", ['role' => Role::ADMIN])
        ->assertOk();

    expect($target->fresh()->hasRole(Role::ADMIN))->toBeTrue();
});

test('an admin (not super admin) cannot ban a super admin', function () {
    $admin = userWithRole(Role::ADMIN);
    $superAdmin = userWithRole(Role::SUPER_ADMIN);

    $this->actingAs($admin, 'sanctum')
        ->postJson("/api/admin/users/{$superAdmin->id}/ban", ['reason' => 'nope'])
        ->assertForbidden();

    expect($superAdmin->fresh()->isBanned())->toBeFalse();
});

test('an admin cannot promote a user to super admin', function () {
    $admin = userWithRole(Role::ADMIN);
    $target = userWithRole(Role::USER);

    $this->actingAs($admin, 'sanctum')
        ->patchJson("/api/admin/users/{$target->id}/role", ['role' => Role::SUPER_ADMIN])
        ->assertForbidden();

    expect($target->fresh()->hasRole(Role::SUPER_ADMIN))->toBeFalse();
});

test('a super admin can ban another super admin', function () {
    $superAdminA = userWithRole(Role::SUPER_ADMIN);
    $superAdminB = userWithRole(Role::SUPER_ADMIN);

    $this->actingAs($superAdminA, 'sanctum')
        ->postJson("/api/admin/users/{$superAdminB->id}/ban", ['reason' => 'allowed'])
        ->assertOk();
});
