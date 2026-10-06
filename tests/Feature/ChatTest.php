<?php

use App\Domain\Chat\Models\Conversation;
use App\Domain\Identity\Models\User;

test('a user can start a private conversation and send a message', function () {
    $me = User::factory()->create();
    [$token] = createUserSession($me);
    $other = User::factory()->create();

    $createResponse = $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson('/api/conversations', ['type' => 'private', 'user_ids' => [$other->id]]);

    $createResponse->assertOk();
    $conversationId = $createResponse->json('data.id');

    $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Hello!'])
        ->assertCreated()
        ->assertJsonPath('data.body', 'Hello!')
        ->assertJsonPath('data.is_mine', true);

    $this->assertDatabaseHas('messages', ['conversation_id' => $conversationId, 'body' => 'Hello!']);
});

test('starting a private conversation twice with the same user reuses the existing one', function () {
    $me = User::factory()->create();
    [$token] = createUserSession($me);
    $other = User::factory()->create();

    $first = $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson('/api/conversations', ['type' => 'private', 'user_ids' => [$other->id]])
        ->json('data.id');

    $second = $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson('/api/conversations', ['type' => 'private', 'user_ids' => [$other->id]])
        ->json('data.id');

    expect($second)->toBe($first);
    expect(Conversation::where('type', 'private')->count())->toBe(1);
});

test('creating a private conversation requires exactly one recipient', function () {
    $me = User::factory()->create();
    [$token] = createUserSession($me);
    $others = User::factory()->count(2)->create();

    $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson('/api/conversations', ['type' => 'private', 'user_ids' => $others->pluck('id')->all()])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('user_ids');
});

test('a user who is not a member of a conversation cannot read or send messages in it', function () {
    $member = User::factory()->create();
    $outsider = User::factory()->create();
    [$outsiderToken] = createUserSession($outsider);

    $conversation = Conversation::create(['type' => 'group', 'title' => 'Team', 'created_by' => $member->id]);
    $conversation->users()->attach($member->id, ['role' => 'creator', 'joined_at' => now()]);

    $this->withHeader('Authorization', "Bearer {$outsiderToken}")
        ->getJson("/api/conversations/{$conversation->id}/messages")
        ->assertNotFound();

    $this->withHeader('Authorization', "Bearer {$outsiderToken}")
        ->postJson("/api/conversations/{$conversation->id}/messages", ['body' => 'sneaky'])
        ->assertNotFound();
});

test('sending a message resets the sender\'s unread count and increments it for other members', function () {
    $sender = User::factory()->create();
    [$token] = createUserSession($sender);
    $recipient = User::factory()->create();

    $conversationId = $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson('/api/conversations', ['type' => 'private', 'user_ids' => [$recipient->id]])
        ->json('data.id');

    $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Hi'])
        ->assertCreated();

    $this->assertDatabaseHas('conversation_users', [
        'conversation_id' => $conversationId,
        'user_id' => $recipient->id,
        'unread_count' => 1,
    ]);

    $this->assertDatabaseHas('conversation_users', [
        'conversation_id' => $conversationId,
        'user_id' => $sender->id,
        'unread_count' => 0,
    ]);
});

test('marking the conversation read clears the unread count of the viewer, listing alone does not', function () {
    $sender = User::factory()->create();
    [$senderToken] = createUserSession($sender);
    $recipient = User::factory()->create();
    [$recipientToken] = createUserSession($recipient);

    $conversationId = $this->withHeader('Authorization', "Bearer {$senderToken}")
        ->postJson('/api/conversations', ['type' => 'private', 'user_ids' => [$recipient->id]])
        ->json('data.id');

    $this->withHeader('Authorization', "Bearer {$senderToken}")
        ->postJson("/api/conversations/{$conversationId}/messages", ['body' => 'Hi'])
        ->assertCreated();

    forgetAuthGuards();

    $this->withHeader('Authorization', "Bearer {$recipientToken}")
        ->getJson("/api/conversations/{$conversationId}/messages")
        ->assertOk();

    $this->assertDatabaseHas('conversation_users', [
        'conversation_id' => $conversationId,
        'user_id' => $recipient->id,
        'unread_count' => 1,
    ]);

    $this->withHeader('Authorization', "Bearer {$recipientToken}")
        ->postJson("/api/conversations/{$conversationId}/read")
        ->assertOk()
        ->assertJsonPath('data.unread_count', 0);

    $this->assertDatabaseHas('conversation_users', [
        'conversation_id' => $conversationId,
        'user_id' => $recipient->id,
        'unread_count' => 0,
    ]);
});

test('a non-member cannot list the members of a conversation by guessing its id', function () {
    $member = User::factory()->create();
    $outsider = User::factory()->create();
    [$outsiderToken] = createUserSession($outsider);

    $conversation = Conversation::create(['type' => 'group', 'title' => 'Team', 'created_by' => $member->id]);
    $conversation->users()->attach($member->id, ['role' => 'creator', 'joined_at' => now()]);

    $this->withHeader('Authorization', "Bearer {$outsiderToken}")
        ->getJson("/api/conversations/{$conversation->id}/members")
        ->assertNotFound();
});

test('a member can list the members of their own conversation', function () {
    $member = User::factory()->create();
    [$token] = createUserSession($member);
    $other = User::factory()->create();

    $conversation = Conversation::create(['type' => 'group', 'title' => 'Team', 'created_by' => $member->id]);
    $conversation->users()->attach($member->id, ['role' => 'creator', 'joined_at' => now()]);
    $conversation->users()->attach($other->id, ['role' => 'member', 'joined_at' => now()]);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson("/api/conversations/{$conversation->id}/members")
        ->assertOk()
        ->assertJsonCount(2, 'data');
});

test('a user can search other users to start a conversation with', function () {
    $me = User::factory()->create();
    [$token] = createUserSession($me);
    $target = User::factory()->create(['name' => 'Findable Person']);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/chat/users/search?q=Findable')
        ->assertOk()
        ->assertJsonFragment(['name' => 'Findable Person']);
});

test('user search never returns the requester themselves', function () {
    $me = User::factory()->create(['name' => 'Searcher Self']);
    [$token] = createUserSession($me);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/chat/users/search?q=Searcher')
        ->assertOk()
        ->assertJsonMissing(['id' => $me->id]);
});
