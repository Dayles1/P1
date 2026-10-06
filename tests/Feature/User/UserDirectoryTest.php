<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Ban\Actions\BanEntity;
use App\Domain\Identity\Models\User;

function banUser(User $user): void
{
    app(BanEntity::class)->handle($user, reason: 'test');
}

test('the directory lists everyone but the requester, by name, without banned users', function () {
    $viewer = userWithRole(Role::USER, ['name' => 'Viewer']);
    userWithRole(Role::USER, ['name' => 'Zara']);
    userWithRole(Role::ADMIN, ['name' => 'Anna', 'last_seen_at' => now()]);
    banUser(userWithRole(Role::USER, ['name' => 'Banned Bob']));

    $response = $this->actingAs($viewer, 'sanctum')
        ->getJson('/api/users')
        ->assertOk()
        ->assertJsonPath('pagination.per_page', 50)
        ->assertJsonPath('pagination.total', 2)
        ->assertJsonStructure(['data' => [['id', 'name', 'email', 'avatar', 'department', 'role', 'last_seen_at', 'is_banned']]]);

    expect(array_column($response->json('data'), 'name'))->toBe(['Anna', 'Zara'])
        ->and($response->json('data.0.role'))->toBe(makeRole(Role::ADMIN)->name)
        ->and($response->json('data.0.last_seen_at'))->not->toBeNull()
        ->and($response->json('data.0.is_banned'))->toBeFalse()
        ->and($response->json('data.1.last_seen_at'))->toBeNull();
});

test('a super admin sees banned users in the directory', function () {
    $superAdmin = userWithRole(Role::SUPER_ADMIN);
    $banned = userWithRole(Role::USER, ['name' => 'Banned Bob']);
    banUser($banned);

    $response = $this->actingAs($superAdmin, 'sanctum')->getJson('/api/users')->assertOk();

    expect($response->json('data'))->toHaveCount(1)
        ->and($response->json('data.0.id'))->toBe($banned->id)
        ->and($response->json('data.0.is_banned'))->toBeTrue();
});

test('the directory searches name and email, treating LIKE wildcards literally', function () {
    $viewer = userWithRole(Role::USER);
    $maria = userWithRole(Role::USER, ['name' => 'Maria Kim', 'email' => 'maria@example.com']);
    $percent = userWithRole(Role::USER, ['name' => '100% Pat', 'email' => 'pat@example.com']);
    userWithRole(Role::USER, ['name' => 'Other', 'email' => 'other@test.dev']);

    $byName = $this->actingAs($viewer, 'sanctum')->getJson('/api/users?q=maria')->assertOk();
    $byEmail = $this->actingAs($viewer, 'sanctum')->getJson('/api/users?q=example.com')->assertOk();
    $byWildcard = $this->actingAs($viewer, 'sanctum')->getJson('/api/users?q='.urlencode('%'))->assertOk();

    expect(array_column($byName->json('data'), 'id'))->toBe([$maria->id])
        ->and(array_column($byEmail->json('data'), 'id'))->toBe([$percent->id, $maria->id])
        ->and(array_column($byWildcard->json('data'), 'id'))->toBe([$percent->id]);
});

test('the directory paginates and validates per_page', function () {
    $viewer = userWithRole(Role::USER);
    User::factory()->count(3)->create();

    $this->actingAs($viewer, 'sanctum')
        ->getJson('/api/users?per_page=2&page=2')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('pagination.current_page', 2)
        ->assertJsonPath('pagination.total', 3);

    $this->actingAs($viewer, 'sanctum')->getJson('/api/users?per_page=101')->assertUnprocessable();
});

test('the directory requires authentication', function () {
    $this->getJson('/api/users')->assertUnauthorized();
});

test('a profile shows the private conversation and the groups both users are in', function () {
    $viewer = userWithRole(Role::USER);
    $other = userWithRole(Role::USER, ['name' => 'Maria']);
    $other->settings()->create(['timezone_id' => timezoneRow('Asia/Tashkent')->id]);
    $third = userWithRole(Role::USER);

    $privateId = startPrivateConversation($viewer, $other);

    $sharedGroupId = $this->actingAs($viewer, 'sanctum')->postJson('/api/conversations', [
        'type' => 'group', 'title' => 'Shared', 'user_ids' => [$other->id, $third->id],
    ])->json('data.id');

    $leftGroupId = $this->actingAs($viewer, 'sanctum')->postJson('/api/conversations', [
        'type' => 'group', 'title' => 'Left', 'user_ids' => [$other->id],
    ])->json('data.id');
    $this->actingAs($viewer, 'sanctum')
        ->deleteJson("/api/conversations/{$leftGroupId}/members", ['user_ids' => [$other->id]])
        ->assertSuccessful();

    $this->actingAs($viewer, 'sanctum')->postJson('/api/conversations', [
        'type' => 'group', 'title' => 'Not shared', 'user_ids' => [$third->id],
    ]);

    $this->actingAs($viewer, 'sanctum')
        ->getJson("/api/users/{$other->id}")
        ->assertOk()
        ->assertJsonPath('data.id', $other->id)
        ->assertJsonPath('data.name', 'Maria')
        ->assertJsonPath('data.role', makeRole(Role::USER)->name)
        ->assertJsonPath('data.timezone', 'Asia/Tashkent')
        ->assertJsonPath('data.is_me', false)
        ->assertJsonPath('data.is_banned', false)
        ->assertJsonPath('data.private_conversation_id', $privateId)
        ->assertJsonPath('data.common_groups', [
            ['id' => $sharedGroupId, 'title' => 'Shared', 'type' => 'group', 'avatar' => null, 'members_count' => 3],
        ])
        ->assertJsonStructure(['data' => ['email', 'avatar', 'department', 'joined_at', 'last_seen_at']]);
});

test('a profile without a conversation yet, and one\'s own profile', function () {
    $viewer = userWithRole(Role::USER);
    $other = userWithRole(Role::USER);

    $this->actingAs($viewer, 'sanctum')
        ->getJson("/api/users/{$other->id}")
        ->assertOk()
        ->assertJsonPath('data.private_conversation_id', null)
        ->assertJsonPath('data.timezone', null)
        ->assertJsonPath('data.common_groups', []);

    $this->actingAs($viewer, 'sanctum')
        ->getJson("/api/users/{$viewer->id}")
        ->assertOk()
        ->assertJsonPath('data.is_me', true);
});

test('a banned user\'s profile is not found, except for a super admin', function () {
    $banned = userWithRole(Role::USER);
    banUser($banned);

    $this->actingAs(userWithRole(Role::ADMIN), 'sanctum')
        ->getJson("/api/users/{$banned->id}")
        ->assertNotFound();

    forgetAuthGuards();

    $this->actingAs(userWithRole(Role::SUPER_ADMIN), 'sanctum')
        ->getJson("/api/users/{$banned->id}")
        ->assertOk()
        ->assertJsonPath('data.is_banned', true);
});
