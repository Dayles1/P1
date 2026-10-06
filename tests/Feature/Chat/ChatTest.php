<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Identity\Models\User;

test('a user can start a private conversation with another user', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);

    $response = $this->actingAs($userA, 'sanctum')->postJson('/api/conversations', [
        'type' => 'private',
        'user_ids' => [$userB->id],
    ]);

    $response->assertOk();
    expect($response->json('data.type'))->toBe('private');
});

test('starting a private conversation twice reuses the same conversation', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);

    $first = $this->actingAs($userA, 'sanctum')->postJson('/api/conversations', [
        'type' => 'private',
        'user_ids' => [$userB->id],
    ])->json('data.id');

    $second = $this->actingAs($userA, 'sanctum')->postJson('/api/conversations', [
        'type' => 'private',
        'user_ids' => [$userB->id],
    ])->json('data.id');

    expect($second)->toBe($first);
});

test('the other person starting the same private chat gets the existing conversation, not a duplicate', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);

    $first = startPrivateConversation($userA, $userB);

    forgetAuthGuards();

    $this->actingAs($userB, 'sanctum')->postJson('/api/conversations', [
        'type' => 'private',
        'user_ids' => [$userA->id],
    ])
        ->assertOk()
        ->assertJsonPath('data.id', $first)
        ->assertJsonPath('data.type', 'private');

    expect(Conversation::query()->where('type', 'private')->count())->toBe(1);
});

test('a private conversation requires exactly one recipient', function () {
    $user = userWithRole(Role::USER);

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/conversations', ['type' => 'private', 'user_ids' => []])
        ->assertUnprocessable();
});

test('a user can create a group conversation with multiple members', function () {
    $creator = userWithRole(Role::USER);
    $memberA = userWithRole(Role::USER);
    $memberB = userWithRole(Role::USER);

    $response = $this->actingAs($creator, 'sanctum')->postJson('/api/conversations', [
        'type' => 'group',
        'title' => 'Team chat',
        'user_ids' => [$memberA->id, $memberB->id],
    ]);

    $response->assertOk();
    expect($response->json('data.members_count'))->toBe(3);
});

test('a member can send and list messages in a conversation', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);

    $conversationId = $this->actingAs($userA, 'sanctum')->postJson('/api/conversations', [
        'type' => 'private',
        'user_ids' => [$userB->id],
    ])->json('data.id');

    $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Hello!'])
        ->assertCreated()
        ->assertJsonPath('data.body', 'Hello!')
        ->assertJsonPath('data.is_mine', true);

    $listAsRecipient = $this->actingAs($userB, 'sanctum')
        ->getJson("/api/conversations/{$conversationId}/messages");

    $listAsRecipient->assertOk();
    expect($listAsRecipient->json('data'))->toHaveCount(1);
    expect($listAsRecipient->json('data.0.is_mine'))->toBeFalse();
});

test('a non-member cannot send messages to a conversation', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);
    $outsider = userWithRole(Role::USER);

    $conversationId = $this->actingAs($userA, 'sanctum')->postJson('/api/conversations', [
        'type' => 'private',
        'user_ids' => [$userB->id],
    ])->json('data.id');

    $this->actingAs($outsider, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'sneaky'])
        ->assertNotFound();
});

test('unread count increments for the recipient and resets when they mark the chat read', function () {
    $userA = userWithRole(Role::USER);
    $userB = userWithRole(Role::USER);

    $conversationId = $this->actingAs($userA, 'sanctum')->postJson('/api/conversations', [
        'type' => 'private',
        'user_ids' => [$userB->id],
    ])->json('data.id');

    $this->actingAs($userA, 'sanctum')
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Hi']);

    $list = $this->actingAs($userB, 'sanctum')->getJson('/api/conversations');
    expect($list->json('data.0.unread_count'))->toBe(1);

    // Listing has no read side effects; reading is its own call.
    $this->actingAs($userB, 'sanctum')->getJson("/api/conversations/{$conversationId}/messages");
    expect($this->actingAs($userB, 'sanctum')->getJson('/api/conversations')->json('data.0.unread_count'))->toBe(1);

    $this->actingAs($userB, 'sanctum')->postJson("/api/conversations/{$conversationId}/read")->assertOk();

    $listAfter = $this->actingAs($userB, 'sanctum')->getJson('/api/conversations');
    expect($listAfter->json('data.0.unread_count'))->toBe(0);
});

test('user search excludes the requester and requires a minimum query length', function () {
    $user = userWithRole(Role::USER);
    $target = User::factory()->create(['name' => 'Findable Person']);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/chat/users/search?q=F')
        ->assertUnprocessable();

    $response = $this->actingAs($user, 'sanctum')->getJson('/api/chat/users/search?q=Findable');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');

    expect($ids)->toContain($target->id);
    expect($ids)->not->toContain($user->id);
});

/**
 * A group titled `$title` and a private chat with a user named `$name`,
 * both with `$owner` in them.
 *
 * @return array{group: int, private: int}
 */
function conversationsToSearch(User $owner, string $title, string $name): array
{
    $group = test()->actingAs($owner, 'sanctum')->postJson('/api/conversations', [
        'type' => 'group',
        'title' => $title,
        'user_ids' => [userWithRole(Role::USER)->id],
    ])->json('data.id');

    $private = test()->actingAs($owner, 'sanctum')->postJson('/api/conversations', [
        'type' => 'private',
        'user_ids' => [userWithRole(Role::USER, ['name' => $name])->id],
    ])->json('data.id');

    return ['group' => $group, 'private' => $private];
}

test('searching all conversations finds groups by title and private chats by the other person', function () {
    $user = userWithRole(Role::USER);
    $ids = conversationsToSearch($user, 'Product team', 'Maria Kim');

    $byTitle = $this->actingAs($user, 'sanctum')
        ->getJson('/api/conversations?type=all&search=product')
        ->assertOk();

    $byName = $this->actingAs($user, 'sanctum')
        ->getJson('/api/conversations?type=all&search=maria')
        ->assertOk();

    expect(array_column($byTitle->json('data'), 'id'))->toBe([$ids['group']])
        ->and(array_column($byName->json('data'), 'id'))->toBe([$ids['private']]);
});

test('searching groups matches their title', function () {
    $user = userWithRole(Role::USER);
    $ids = conversationsToSearch($user, 'Product team', 'Maria Kim');

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/conversations?type=group&search=team')
        ->assertOk();

    expect(array_column($response->json('data'), 'id'))->toBe([$ids['group']]);
});
