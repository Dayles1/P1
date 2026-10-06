<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Chat\Events\MessageRead;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Models\MessageRead as MessageReadRow;
use App\Domain\Identity\Models\RequestLog;
use App\Domain\Identity\Models\User;
use App\Domain\Setting\Services\SettingService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;

test('a reply can only quote a message of the same conversation', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $carol = userWithRole(Role::USER);

    $secretChat = startPrivateConversation($bob, $carol);
    $secretId = sendChatMessage($bob, $secretChat, 'the secret');

    forgetAuthGuards();
    $myChat = startPrivateConversation($alice, $bob);

    $this->actingAs($alice, 'sanctum')
        ->postJson("/api/conversations/{$myChat}/messages", ['body' => 'x', 'parent_message_id' => $secretId])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('parent_message_id');

    expect(Message::query()->where('conversation_id', $myChat)->count())->toBe(0);
});

test('a reply to a deleted message is rejected, and a quote of a later-deleted one is dropped', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);

    $parentId = sendChatMessage($bob, $chat, 'parent');
    $replyId = sendChatMessage($alice, $chat, 'reply', ['parent_message_id' => $parentId]);

    $this->actingAs($bob, 'sanctum')->deleteJson("/api/conversations/{$chat}/messages/{$parentId}")->assertOk();

    $this->actingAs($alice, 'sanctum')
        ->postJson("/api/conversations/{$chat}/messages", ['body' => 'again', 'parent_message_id' => $parentId])
        ->assertUnprocessable();

    $messages = collect($this->actingAs($alice, 'sanctum')->getJson("/api/conversations/{$chat}/messages")->json('data'));

    expect($messages->firstWhere('id', $replyId)['reply_to'])->toBeNull();
});

test('a non-member cannot mark messages read or fake read receipts', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $outsider = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);
    $messageId = sendChatMessage($alice, $chat, 'hi');

    Event::fake([MessageRead::class]);

    $this->actingAs($outsider, 'sanctum')
        ->postJson("/api/conversations/{$chat}/messages/{$messageId}/read")
        ->assertNotFound();

    $this->actingAs($outsider, 'sanctum')
        ->postJson("/api/conversations/{$chat}/read")
        ->assertNotFound();

    expect(MessageReadRow::query()->where('user_id', $outsider->id)->exists())->toBeFalse();
    Event::assertNotDispatched(MessageRead::class);
});

test('only the creator and admins can remove members, and admins only ordinary ones', function () {
    $creator = userWithRole(Role::USER);
    $admin = userWithRole(Role::USER);
    $member = userWithRole(Role::USER);
    $other = userWithRole(Role::USER);
    $group = startGroupConversation($creator, [$admin, $member, $other]);

    $this->actingAs($creator, 'sanctum')
        ->patchJson("/api/conversations/{$group}/members/{$admin->id}", ['role' => 'admin'])
        ->assertOk();

    // An ordinary member may not remove anyone.
    $this->actingAs($member, 'sanctum')
        ->deleteJson("/api/conversations/{$group}/members", ['user_ids' => [$other->id]])
        ->assertForbidden()
        ->assertJsonPath('code', 'chat.not_manager');

    // An admin may not remove the creator.
    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/conversations/{$group}/members", ['user_ids' => [$creator->id]])
        ->assertForbidden();

    // An admin may remove an ordinary member.
    $this->actingAs($admin, 'sanctum')
        ->deleteJson("/api/conversations/{$group}/members", ['user_ids' => [$other->id]])
        ->assertOk()
        ->assertJsonPath('data.members.removed', [$other->id]);

    // Someone who was removed is no longer a member at all.
    $this->actingAs($other, 'sanctum')
        ->deleteJson("/api/conversations/{$group}/members", ['user_ids' => [$member->id]])
        ->assertNotFound();
});

test('someone who left a group loses every management right', function () {
    $creator = userWithRole(Role::USER);
    $member = userWithRole(Role::USER);
    $newcomer = userWithRole(Role::USER);
    $group = startGroupConversation($creator, [$member]);

    $this->actingAs($creator, 'sanctum')->postJson("/api/conversations/{$group}/leave")->assertOk();

    $this->actingAs($creator, 'sanctum')
        ->postJson("/api/conversations/{$group}/members", ['user_ids' => [$newcomer->id]])
        ->assertNotFound();

    $this->actingAs($creator, 'sanctum')
        ->patchJson("/api/conversations/{$group}", ['title' => 'Hijacked'])
        ->assertNotFound();

    expect(ConversationUser::query()->where('conversation_id', $group)->where('user_id', $member->id)->value('role'))
        ->toBe(ConversationUser::ROLE_CREATOR);
});

test('active content is never accepted as an attachment, whatever the allowed list says', function (string $name, string $mime, string $content) {
    Storage::fake('public');
    app(SettingService::class);
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);

    $path = tempnam(sys_get_temp_dir(), 'up');
    file_put_contents($path, $content);

    $this->actingAs($alice, 'sanctum')->post("/api/conversations/{$chat}/messages", [
        'attachments' => [new UploadedFile($path, $name, $mime, null, true)],
    ], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('attachments.0');
})->with([
    'svg' => ['x.svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
    'html' => ['x.html', 'text/html', '<html><script>alert(1)</script></html>'],
    'svg disguised as audio' => ['voice.svg', 'audio/webm', '<svg xmlns="http://www.w3.org/2000/svg"></svg>'],
    'unknown blob labelled audio without an audio extension' => ['voice.bin', 'audio/webm', random_bytes(64)],
]);

test('chat requests are logged without their content', function () {
    config(['request-logging.enabled' => true]);
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    [$token] = createUserSession($alice);

    $chat = $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson('/api/conversations', ['type' => 'private', 'user_ids' => [$bob->id]])
        ->json('data.id');

    $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson("/api/conversations/{$chat}/messages", ['body' => 'my private words'])
        ->assertCreated();

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/messages/search?q=private')
        ->assertOk();

    $logs = RequestLog::query()->where('path', 'like', '/api/%')->get();

    expect($logs)->not->toBeEmpty();

    foreach ($logs as $log) {
        expect(json_encode([$log->body, $log->response_body, $log->query]))->not->toContain('private');
    }
});

test('a member cannot list members or messages of a chat they are not in, and gets 404', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $outsider = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);

    foreach (["/api/conversations/{$chat}", "/api/conversations/{$chat}/summary", "/api/conversations/{$chat}/members", "/api/conversations/{$chat}/messages"] as $url) {
        $this->actingAs($outsider, 'sanctum')->getJson($url)->assertNotFound();
    }
});

test('adding members never answers with a raw exception message', function () {
    $creator = userWithRole(Role::USER);
    $member = userWithRole(Role::USER);
    $group = startGroupConversation($creator, [$member]);

    $this->actingAs($member, 'sanctum')
        ->postJson("/api/conversations/{$group}/members", ['user_ids' => [userWithRole(Role::USER)->id]])
        ->assertForbidden()
        ->assertJsonPath('success', false)
        ->assertJsonMissingPath('exception');
});

test('sending, typing, reacting and searching are rate limited per user', function (string $limiter, string $method, string $url) {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);
    $messageId = sendChatMessage($bob, $chat, 'react to me');
    config(["chat.rate_limits.{$limiter}" => 2]);

    $url = str_replace(['{chat}', '{message}'], [$chat, $messageId], $url);
    $payload = ['body' => 'hi', 'emoji' => '👍', 'q' => 'hi'];

    RateLimiter::clear("chat-{$limiter}");

    foreach (range(1, 2) as $attempt) {
        $this->actingAs($alice, 'sanctum')->json($method, $url, $payload)->assertSuccessful();
    }

    $this->actingAs($alice, 'sanctum')->json($method, $url, $payload)->assertTooManyRequests();
})->with([
    'send' => ['send', 'POST', '/api/conversations/{chat}/messages'],
    'typing' => ['typing', 'POST', '/api/conversations/{chat}/typing'],
    'reactions' => ['reactions', 'POST', '/api/conversations/{chat}/messages/{message}/reactions'],
    'search' => ['search', 'GET', '/api/messages/search'],
]);

test('only the allowed emoji can be used as a reaction', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);
    $messageId = sendChatMessage($alice, $chat, 'hi');

    $this->actingAs($bob, 'sanctum')
        ->postJson("/api/conversations/{$chat}/messages/{$messageId}/reactions", ['emoji' => 'not an emoji'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('emoji');

    $this->actingAs($bob, 'sanctum')
        ->postJson("/api/conversations/{$chat}/messages/{$messageId}/reactions", ['emoji' => '❤️‍🔥'])
        ->assertOk()
        ->assertJsonPath('data.added', true);
});

test('the members list does not reveal other people\'s mute settings', function () {
    $creator = userWithRole(Role::USER);
    $member = userWithRole(Role::USER);
    $group = startGroupConversation($creator, [$member]);

    ConversationUser::query()->where('conversation_id', $group)->where('user_id', $member->id)->update(['muted_until' => now()->addDay()]);

    $members = $this->actingAs($creator, 'sanctum')->getJson("/api/conversations/{$group}/members")->assertOk()->json('data');

    expect($members[0])->not->toHaveKey('muted_until')
        ->and($members[0]['role'])->toBe('creator')
        ->and($members[0])->toHaveKey('joined_at_iso');
});

test('user search treats wildcards literally', function () {
    $user = userWithRole(Role::USER);
    User::factory()->create(['name' => 'Plain Person']);

    $response = $this->actingAs($user, 'sanctum')->getJson('/api/chat/users/search?q=%25%25')->assertOk();

    expect($response->json('data'))->toBe([]);
});

test('a malformed conversation channel name is refused, not a server error', function () {
    $user = userWithRole(Role::USER);
    [$token] = createUserSession($user);
    config(['broadcasting.default' => 'reverb', 'broadcasting.connections.reverb.key' => 'key', 'broadcasting.connections.reverb.secret' => 'secret', 'broadcasting.connections.reverb.app_id' => 'app']);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->postJson('/broadcasting/auth', ['socket_id' => '1.1', 'channel_name' => 'private-conversation.abc'])
        ->assertForbidden();
});
