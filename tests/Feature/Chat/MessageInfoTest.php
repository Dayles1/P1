<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Chat\Models\MessageEdit;
use App\Domain\Notification\Services\ChatNotifier;

test('every edit keeps the previous text, with who edited and when', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);
    $messageId = sendChatMessage($alice, $chat, 'v1');

    $this->travelTo(now()->addMinute());
    $this->actingAs($alice, 'sanctum')->patchJson("/api/conversations/{$chat}/messages/{$messageId}", ['body' => 'v2'])->assertOk();
    $this->travelTo(now()->addMinute());
    $this->actingAs($alice, 'sanctum')->patchJson("/api/conversations/{$chat}/messages/{$messageId}", ['body' => 'v3'])
        ->assertOk()
        ->assertJsonPath('data.body', 'v3')
        ->assertJsonPath('data.edit_count', 2)
        ->assertJsonPath('data.edited_at_iso', fn ($value) => is_string($value));

    // The same text again is no edit.
    $this->actingAs($alice, 'sanctum')->patchJson("/api/conversations/{$chat}/messages/{$messageId}", ['body' => 'v3'])->assertOk();

    expect(MessageEdit::query()->where('message_id', $messageId)->orderBy('id')->pluck('previous_body')->all())->toBe(['v1', 'v2']);
});

test('service messages and polls cannot be edited', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $group = startGroupConversation($alice, [$bob]);

    $systemId = $this->actingAs($alice, 'sanctum')->getJson("/api/conversations/{$group}/messages")->json('data.0.id');

    $this->actingAs($alice, 'sanctum')->patchJson("/api/conversations/{$group}/messages/{$systemId}", ['body' => 'x'])
        ->assertUnprocessable();

    $pollId = $this->actingAs($alice, 'sanctum')->postJson("/api/conversations/{$group}/polls", [
        'question' => 'Lunch?', 'options' => ['Yes', 'No'],
    ])->assertCreated()->json('data.id');

    $this->actingAs($alice, 'sanctum')->patchJson("/api/conversations/{$group}/messages/{$pollId}", ['body' => 'x'])
        ->assertUnprocessable();
});

test('the info view has sent time, readers with times, who has not read, edits, reactions and the pin', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $carol = userWithRole(Role::USER);
    $group = startGroupConversation($alice, [$bob, $carol]);
    $messageId = sendChatMessage($alice, $group, 'first');

    $this->actingAs($alice, 'sanctum')->patchJson("/api/conversations/{$group}/messages/{$messageId}", ['body' => 'second'])->assertOk();
    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$group}/read")->assertOk();
    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$group}/messages/{$messageId}/reactions", ['emoji' => '🔥'])->assertOk();
    $this->actingAs($carol, 'sanctum')->postJson("/api/conversations/{$group}/messages/{$messageId}/pin")->assertOk();

    $info = $this->actingAs($alice, 'sanctum')->getJson("/api/conversations/{$group}/messages/{$messageId}/info")
        ->assertOk()
        ->assertJsonPath('data.message.id', $messageId)
        ->assertJsonPath('data.sender.id', $alice->id)
        ->assertJsonPath('data.edits.count', 1)
        ->assertJsonPath('data.edits.history.0.previous_body', 'first')
        ->assertJsonPath('data.edits.history.0.editor.id', $alice->id)
        ->assertJsonPath('data.reads.0.user.id', $bob->id)
        ->assertJsonPath('data.unread_by.0.id', $carol->id)
        ->assertJsonPath('data.reactions.0.emoji', '🔥')
        ->assertJsonPath('data.reactions.0.users.0.id', $bob->id)
        ->assertJsonPath('data.pinned.by.id', $carol->id)
        ->assertJsonPath('data.poll_voters', null)
        ->json('data');

    expect($info['sent_at_iso'])->toBeString()
        ->and($info['reads'][0]['read_at_iso'])->toBeString()
        ->and($info['reactions'][0]['users'][0]['reacted_at_iso'])->toBeString()
        ->and($info['reads'])->toHaveCount(1)
        ->and($info['unread_by'])->toHaveCount(1);
});

test('the info view lists poll voters only for public polls', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $group = startGroupConversation($alice, [$bob]);

    $public = $this->actingAs($alice, 'sanctum')->postJson("/api/conversations/{$group}/polls", [
        'question' => 'Lunch?', 'options' => ['Yes', 'No'],
    ])->json('data.id');
    $secret = $this->actingAs($alice, 'sanctum')->postJson("/api/conversations/{$group}/polls", [
        'question' => 'Salary?', 'options' => ['Yes', 'No'], 'anonymous' => true,
    ])->json('data.id');

    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$group}/messages/{$public}/vote", ['option_ids' => [1]])->assertOk();
    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$group}/messages/{$secret}/vote", ['option_ids' => [1]])->assertOk();

    $this->actingAs($alice, 'sanctum')->getJson("/api/conversations/{$group}/messages/{$public}/info")
        ->assertJsonPath('data.poll_voters.1.option_id', 1)
        ->assertJsonPath('data.poll_voters.1.users.0.id', $bob->id);

    $this->actingAs($alice, 'sanctum')->getJson("/api/conversations/{$group}/messages/{$secret}/info")
        ->assertJsonPath('data.poll_voters', null);
});

test('only members see a message\'s info, and only messages of that chat', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $outsider = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);
    $messageId = sendChatMessage($alice, $chat, 'hi');
    $otherChat = startPrivateConversation($alice, $outsider);

    $this->actingAs($outsider, 'sanctum')->getJson("/api/conversations/{$chat}/messages/{$messageId}/info")->assertNotFound();
    $this->actingAs($outsider, 'sanctum')->getJson("/api/conversations/{$otherChat}/messages/{$messageId}/info")->assertNotFound();
});

test('a new reaction and a pin are handed to the notifier, a removed reaction is not', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);
    $messageId = sendChatMessage($alice, $chat, 'hi');

    $this->mock(ChatNotifier::class, function ($mock) use ($bob, $messageId) {
        $mock->shouldReceive('reactionAdded')->once()->withArgs(fn ($actor, $message, $emoji) => $actor->id === $bob->id && $message->id === $messageId && $emoji === '👍');
        $mock->shouldReceive('messagePinned')->once()->withArgs(fn ($actor, $message) => $actor->id === $bob->id && $message->id === $messageId);
    });

    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$chat}/messages/{$messageId}/reactions", ['emoji' => '👍'])->assertJsonPath('data.added', true);
    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$chat}/messages/{$messageId}/reactions", ['emoji' => '👍'])->assertJsonPath('data.added', false);
    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$chat}/messages/{$messageId}/pin")
        ->assertOk()
        ->assertJsonPath('data.pinned_by.id', $bob->id);

    $events = array_column(array_column($this->actingAs($alice, 'sanctum')->getJson("/api/conversations/{$chat}/messages")->json('data'), 'system'), 'event');
    expect($events)->toContain('message_pinned');
});
