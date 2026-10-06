<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Chat\Events\ConversationRemoved;
use App\Domain\Chat\Events\ConversationSettingsChanged;
use App\Domain\Chat\Events\ConversationUpdated;
use App\Domain\Chat\Events\MessageHidden;
use App\Domain\Chat\Events\MessageSent;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\ConversationUser;
use App\Domain\Chat\Models\Message;
use App\Domain\Notification\Services\ChatNotifier;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;

test('delete for me hides a message only for me and tells only my devices', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);
    $messageId = sendChatMessage($bob, $chat, 'hello');

    Event::fake([MessageHidden::class]);

    $this->actingAs($alice, 'sanctum')
        ->deleteJson("/api/conversations/{$chat}/messages/{$messageId}?for=me")
        ->assertOk()
        ->assertJsonPath('data.hidden_ids', [$messageId]);

    expect($this->actingAs($alice, 'sanctum')->getJson("/api/conversations/{$chat}/messages")->json('data'))->toBe([])
        ->and($this->actingAs($bob, 'sanctum')->getJson("/api/conversations/{$chat}/messages")->json('data'))->toHaveCount(1)
        ->and(ConversationUser::query()->where('conversation_id', $chat)->where('user_id', $alice->id)->value('unread_count'))->toBe(0);

    Event::assertDispatched(MessageHidden::class, fn (MessageHidden $event) => $event->userIds === [$alice->id]);
});

test('nobody can delete someone else\'s message for everyone, except group managers', function () {
    $creator = userWithRole(Role::USER);
    $member = userWithRole(Role::USER);
    $other = userWithRole(Role::USER);
    $group = startGroupConversation($creator, [$member, $other]);
    $messageId = sendChatMessage($member, $group, 'oops');

    $this->actingAs($other, 'sanctum')->deleteJson("/api/conversations/{$group}/messages/{$messageId}")->assertForbidden();
    $this->actingAs($creator, 'sanctum')->deleteJson("/api/conversations/{$group}/messages/{$messageId}")->assertOk();

    expect(Message::withTrashed()->find($messageId)->trashed())->toBeTrue();
});

test('bulk delete deletes for everyone or hides for me', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);
    $mine = [sendChatMessage($alice, $chat, 'a'), sendChatMessage($alice, $chat, 'b')];
    $theirs = sendChatMessage($bob, $chat, 'c');

    $this->actingAs($alice, 'sanctum')
        ->postJson("/api/conversations/{$chat}/messages/delete", ['message_ids' => [...$mine, $theirs], 'for' => 'everyone'])
        ->assertForbidden();

    $this->actingAs($alice, 'sanctum')
        ->postJson("/api/conversations/{$chat}/messages/delete", ['message_ids' => $mine, 'for' => 'everyone'])
        ->assertOk()
        ->assertJsonPath('data.deleted_ids', $mine);

    $this->actingAs($alice, 'sanctum')
        ->postJson("/api/conversations/{$chat}/messages/delete", ['message_ids' => [$theirs], 'for' => 'me'])
        ->assertOk()
        ->assertJsonPath('data.hidden_ids', [$theirs]);
});

test('forwarding copies messages in order with their origin, after the comment', function () {
    Storage::fake('public');
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER, ['name' => 'Bob']);
    $carol = userWithRole(Role::USER);
    $source = startPrivateConversation($alice, $bob);
    $first = sendChatMessage($bob, $source, 'one');
    $second = $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$source}/messages", [
        'body' => 'two', 'attachments' => [UploadedFile::fake()->image('p.jpg')],
    ])->json('data.id');
    forgetAuthGuards();
    $target = startPrivateConversation($alice, $carol);

    $response = $this->actingAs($alice, 'sanctum')->postJson('/api/messages/forward', [
        'from_conversation_id' => $source,
        'message_ids' => [$second, $first],
        'conversation_ids' => [$target],
        'comment' => 'look',
    ])->assertCreated();

    $messages = $response->json('data.conversations.0.messages');

    expect($response->json('data.conversations.0.conversation_id'))->toBe($target)
        ->and(array_column($messages, 'body'))->toBe(['look', 'one', 'two'])
        ->and($messages[1]['forwarded_from']['message_id'])->toBe($first)
        ->and($messages[1]['forwarded_from']['sender_name'])->toBe('Bob')
        ->and($messages[2]['attachments'][0]['kind'])->toBe('image')
        ->and($messages[0]['forwarded_from'])->toBeNull();

    // Forwarding a forward keeps the original origin; hide_sender drops it.
    $again = $this->actingAs($alice, 'sanctum')->postJson('/api/messages/forward', [
        'from_conversation_id' => $target,
        'message_ids' => [$messages[1]['id']],
        'conversation_ids' => [$source],
    ])->json('data.conversations.0.messages.0');
    expect($again['forwarded_from']['message_id'])->toBe($first);

    $hidden = $this->actingAs($alice, 'sanctum')->postJson('/api/messages/forward', [
        'from_conversation_id' => $source,
        'message_ids' => [$first],
        'conversation_ids' => [$target],
        'hide_sender' => true,
    ])->json('data.conversations.0.messages.0');
    expect($hidden['forwarded_from'])->toBeNull();
});

test('forwarding needs membership of the source and the right to post in every target', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $outsider = userWithRole(Role::USER);
    $source = startPrivateConversation($alice, $bob);
    $messageId = sendChatMessage($alice, $source, 'hi');
    $channel = startGroupConversation($bob, [$alice], 'channel', 'News');
    forgetAuthGuards();
    $outsiderChat = startPrivateConversation($outsider, $bob);

    $this->actingAs($outsider, 'sanctum')->postJson('/api/messages/forward', [
        'from_conversation_id' => $source, 'message_ids' => [$messageId], 'conversation_ids' => [$outsiderChat],
    ])->assertNotFound();

    $this->actingAs($alice, 'sanctum')->postJson('/api/messages/forward', [
        'from_conversation_id' => $source, 'message_ids' => [$messageId], 'conversation_ids' => [$channel],
    ])->assertForbidden()->assertJsonPath('code', 'chat.channel_read_only');
});

test('creating a group, adding and removing people leave service lines that do not count as unread', function () {
    $creator = userWithRole(Role::USER, ['name' => 'Ann']);
    $member = userWithRole(Role::USER, ['name' => 'Ben']);
    $newcomer = userWithRole(Role::USER, ['name' => 'Cid']);

    $this->mock(ChatNotifier::class, function ($mock) {
        $mock->shouldReceive('membersAdded')->twice();
        $mock->shouldReceive('messageSent')->never();
    });

    $group = startGroupConversation($creator, [$member], 'group', 'Crew');
    $this->actingAs($creator, 'sanctum')->postJson("/api/conversations/{$group}/members", ['user_ids' => [$newcomer->id]])->assertOk();
    $this->actingAs($creator, 'sanctum')->deleteJson("/api/conversations/{$group}/members", ['user_ids' => [$newcomer->id]])->assertOk();

    $messages = $this->actingAs($member, 'sanctum')->getJson("/api/conversations/{$group}/messages")->json('data');

    expect(array_column(array_column($messages, 'system'), 'event'))->toBe(['group_created', 'members_added', 'member_removed'])
        ->and($messages[1]['system']['params']['names'])->toBe(['Cid'])
        ->and($messages[0]['system']['actor']['name'])->toBe('Ann')
        ->and(ConversationUser::query()->where('conversation_id', $group)->where('user_id', $member->id)->value('unread_count'))->toBe(0);

    $this->actingAs($member, 'sanctum')->getJson('/api/conversations')
        ->assertJsonPath('data.0.last_message.type', 'system')
        ->assertJsonPath('data.0.last_message.preview', __('messages.chat.system.member_removed', ['actor' => 'Ann', 'name' => 'Cid']));
});

test('the removed member hears they were removed', function () {
    $creator = userWithRole(Role::USER);
    $member = userWithRole(Role::USER);
    $group = startGroupConversation($creator, [$member]);

    Event::fake([ConversationRemoved::class, ConversationUpdated::class, MessageSent::class]);

    $this->actingAs($creator, 'sanctum')->deleteJson("/api/conversations/{$group}/members", ['user_ids' => [$member->id]])->assertOk();

    Event::assertDispatched(ConversationRemoved::class, fn (ConversationRemoved $event) => $event->userIds === [$member->id] && $event->reason === 'removed');
    Event::assertDispatched(ConversationUpdated::class, fn (ConversationUpdated $event) => $event->membersCount === 1);
});

test('the chat list puts pinned chats first, then the most recent activity, and hides archived chats', function () {
    $me = userWithRole(Role::USER);
    $a = userWithRole(Role::USER);
    $b = userWithRole(Role::USER);
    $c = userWithRole(Role::USER);

    $chatA = startPrivateConversation($me, $a);
    $this->travel(1)->minutes();
    $chatB = startPrivateConversation($me, $b);
    $this->travel(1)->minutes();
    $chatC = startPrivateConversation($me, $c);
    $this->travel(1)->minutes();
    sendChatMessage($a, $chatA, 'newest');

    $this->actingAs($me, 'sanctum')->patchJson("/api/conversations/{$chatB}/settings", ['pinned' => true])->assertOk();
    $this->actingAs($me, 'sanctum')->patchJson("/api/conversations/{$chatC}/settings", ['archived' => true])
        ->assertOk()
        ->assertJsonPath('data.is_archived', true);

    $all = $this->actingAs($me, 'sanctum')->getJson('/api/conversations')->assertOk();
    expect(array_column($all->json('data'), 'id'))->toBe([$chatB, $chatA]);

    $archived = $this->actingAs($me, 'sanctum')->getJson('/api/conversations?folder=archived')->assertOk();
    expect(array_column($archived->json('data'), 'id'))->toBe([$chatC]);

    // A new message brings an unmuted archived chat back.
    sendChatMessage($c, $chatC, 'back');
    expect(array_column($this->actingAs($me, 'sanctum')->getJson('/api/conversations')->json('data'), 'id'))->toContain($chatC);
});

test('the chat list item has the full shape', function () {
    $me = userWithRole(Role::USER);
    $other = userWithRole(Role::USER, ['name' => 'Other']);
    $chat = startPrivateConversation($me, $other);
    sendChatMessage($me, $chat, 'hey');

    $this->actingAs($me, 'sanctum')->getJson("/api/conversations/{$chat}/summary")
        ->assertOk()
        ->assertJsonStructure(['data' => [
            'id', 'type', 'title', 'description', 'avatar', 'other_user' => ['id', 'name', 'avatar', 'last_seen_at_iso'],
            'other_user_id', 'is_saved', 'my_role', 'members_count', 'is_pinned', 'pinned_at_iso', 'is_muted',
            'muted_until_iso', 'is_archived', 'marked_unread', 'unread_count', 'unread_mentions_count',
            'last_read_message_id', 'last_message' => ['id', 'type', 'preview', 'sender_id', 'sender_name', 'created_at_iso', 'attachment_kind', 'is_read'],
            'last_message_at_iso', 'created_at_iso', 'is_blocked', 'can_send',
        ]])
        ->assertJsonPath('data.title', 'Other')
        ->assertJsonPath('data.members_count', 2)
        ->assertJsonPath('data.last_message.is_read', false)
        ->assertJsonPath('data.can_send', true);

    $this->actingAs($other, 'sanctum')->postJson("/api/conversations/{$chat}/read")->assertOk();

    $this->actingAs($me, 'sanctum')->getJson("/api/conversations/{$chat}/summary")
        ->assertJsonPath('data.last_message.is_read', true);
});

test('settings: mute, mark unread and pin, each told to my other devices', function () {
    $me = userWithRole(Role::USER);
    $other = userWithRole(Role::USER);
    $chat = startPrivateConversation($me, $other);

    Event::fake([ConversationSettingsChanged::class]);

    $this->actingAs($me, 'sanctum')->patchJson("/api/conversations/{$chat}/settings", ['mute' => '8h'])
        ->assertOk()
        ->assertJsonPath('data.is_muted', true)
        ->assertJsonPath('data.muted_until_iso', fn ($value) => is_string($value));

    $this->actingAs($me, 'sanctum')->patchJson("/api/conversations/{$chat}/settings", ['mute' => 'forever'])
        ->assertJsonPath('data.is_muted', true);

    $this->actingAs($me, 'sanctum')->patchJson("/api/conversations/{$chat}/settings", ['mute' => 'off', 'marked_unread' => true, 'pinned' => true])
        ->assertJsonPath('data.is_muted', false)
        ->assertJsonPath('data.marked_unread', true)
        ->assertJsonPath('data.is_pinned', true)
        ->assertJsonPath('data.pinned_at_iso', fn ($value) => is_string($value));

    $this->actingAs($me, 'sanctum')->getJson('/api/conversations/unread')
        ->assertOk()
        ->assertJsonPath('data.chats', 1)
        ->assertJsonPath('data.total', 0);

    // Reading clears "marked unread".
    $this->actingAs($me, 'sanctum')->postJson("/api/conversations/{$chat}/read")->assertOk();
    $this->actingAs($me, 'sanctum')->getJson("/api/conversations/{$chat}/summary")->assertJsonPath('data.marked_unread', false);

    Event::assertDispatchedTimes(ConversationSettingsChanged::class, 3);
    Event::assertDispatched(ConversationSettingsChanged::class, fn (ConversationSettingsChanged $event) => $event->userIds === [$me->id]);
});

test('at most ten chats can be pinned', function () {
    config(['chat.max_pinned_conversations' => 2]);
    $me = userWithRole(Role::USER);
    $chats = array_map(fn () => startPrivateConversation($me, userWithRole(Role::USER)), range(1, 3));

    $this->actingAs($me, 'sanctum')->patchJson("/api/conversations/{$chats[0]}/settings", ['pinned' => true])->assertOk();
    $this->actingAs($me, 'sanctum')->postJson("/api/conversations/{$chats[1]}/pin")->assertOk();
    $this->actingAs($me, 'sanctum')->patchJson("/api/conversations/{$chats[2]}/settings", ['pinned' => true])->assertUnprocessable();
});

test('unread totals leave out muted and archived chats', function () {
    $me = userWithRole(Role::USER);
    [$a, $b, $c] = [userWithRole(Role::USER), userWithRole(Role::USER), userWithRole(Role::USER)];
    $chatA = startPrivateConversation($me, $a);
    $chatB = startPrivateConversation($me, $b);
    $chatC = startPrivateConversation($me, $c);

    sendChatMessage($a, $chatA, '1');
    sendChatMessage($a, $chatA, '2');
    sendChatMessage($b, $chatB, '3');
    sendChatMessage($c, $chatC, '4');

    $this->actingAs($me, 'sanctum')->patchJson("/api/conversations/{$chatB}/settings", ['mute' => '1d'])->assertOk();
    $this->actingAs($me, 'sanctum')->patchJson("/api/conversations/{$chatC}/settings", ['archived' => true])->assertOk();

    $this->actingAs($me, 'sanctum')->getJson('/api/conversations/unread')
        ->assertOk()
        ->assertExactJson(['success' => true, 'message' => 'Operation successful', 'data' => ['total' => 2, 'chats' => 1, 'archived_unread' => 1, 'muted' => 1]]);
});

test('clearing history hides everything so far for me only', function () {
    $me = userWithRole(Role::USER);
    $other = userWithRole(Role::USER);
    $chat = startPrivateConversation($me, $other);
    sendChatMessage($other, $chat, 'old');

    $this->actingAs($me, 'sanctum')->postJson("/api/conversations/{$chat}/clear")
        ->assertOk()
        ->assertJsonPath('data.unread_count', 0)
        ->assertJsonPath('data.last_message', null);

    sendChatMessage($other, $chat, 'new');

    expect(array_column($this->actingAs($me, 'sanctum')->getJson("/api/conversations/{$chat}/messages")->json('data'), 'body'))->toBe(['new'])
        ->and($this->actingAs($other, 'sanctum')->getJson("/api/conversations/{$chat}/messages")->json('data'))->toHaveCount(2);
});

test('deleting a private chat is delete-for-me: it comes back with the next message and is never duplicated', function () {
    $me = userWithRole(Role::USER);
    $other = userWithRole(Role::USER);
    $chat = startPrivateConversation($me, $other);
    sendChatMessage($me, $chat, 'hi');

    $this->actingAs($me, 'sanctum')->deleteJson("/api/conversations/{$chat}")->assertOk();

    expect($this->actingAs($me, 'sanctum')->getJson('/api/conversations')->json('data'))->toBe([])
        ->and(ConversationUser::query()->where('conversation_id', $chat)->whereNull('left_at')->count())->toBe(2);

    // Starting a chat with them again finds the same one.
    expect(startPrivateConversation($me, $other))->toBe($chat);

    sendChatMessage($other, $chat, 'still here?');

    $list = $this->actingAs($me, 'sanctum')->getJson('/api/conversations')->json('data');
    expect(array_column($list, 'id'))->toBe([$chat])
        ->and(array_column($this->actingAs($me, 'sanctum')->getJson("/api/conversations/{$chat}/messages")->json('data'), 'body'))->toBe(['still here?'])
        ->and(Conversation::query()->where('type', 'private')->count())->toBe(1);
});

test('a private chat with yourself is your Saved Messages, created once', function () {
    $me = userWithRole(Role::USER);

    $viaStore = $this->actingAs($me, 'sanctum')->postJson('/api/conversations', ['type' => 'private', 'user_ids' => [$me->id]])->json('data.id');
    $viaSaved = $this->actingAs($me, 'sanctum')->getJson('/api/conversations/saved')
        ->assertOk()
        ->assertJsonPath('data.is_saved', true)
        ->assertJsonPath('data.type', 'saved')
        ->json('data.id');

    expect($viaSaved)->toBe($viaStore)
        ->and(Conversation::query()->where('type', 'saved')->count())->toBe(1);

    sendChatMessage($me, $viaSaved, 'note to self');
});

test('only the creator deletes a group, for everyone', function () {
    $creator = userWithRole(Role::USER);
    $member = userWithRole(Role::USER);
    $group = startGroupConversation($creator, [$member]);

    $this->actingAs($member, 'sanctum')->deleteJson("/api/conversations/{$group}")->assertForbidden();

    Event::fake([ConversationRemoved::class]);

    $this->actingAs($creator, 'sanctum')->deleteJson("/api/conversations/{$group}")->assertOk();

    expect(Conversation::query()->find($group))->toBeNull();
    Event::assertDispatched(ConversationRemoved::class, fn (ConversationRemoved $event) => $event->reason === 'deleted' && count($event->userIds) === 2);
});

test('when the creator leaves, the earliest admin becomes the owner', function () {
    $creator = userWithRole(Role::USER);
    $member = userWithRole(Role::USER);
    $admin = userWithRole(Role::USER);
    $group = startGroupConversation($creator, [$member, $admin]);

    $this->actingAs($creator, 'sanctum')->patchJson("/api/conversations/{$group}/members/{$admin->id}", ['role' => 'admin'])->assertOk();

    Event::fake([ConversationRemoved::class]);
    $this->actingAs($creator, 'sanctum')->postJson("/api/conversations/{$group}/leave")->assertOk();

    expect(ConversationUser::query()->where('conversation_id', $group)->where('user_id', $admin->id)->value('role'))->toBe('creator');
    Event::assertDispatched(ConversationRemoved::class, fn (ConversationRemoved $event) => $event->userIds === [$creator->id] && $event->reason === 'left');

    $events = array_column(array_column($this->actingAs($member, 'sanctum')->getJson("/api/conversations/{$group}/messages")->json('data'), 'system'), 'event');
    expect($events)->toContain('member_left');
});

test('roles: only the creator changes them, and can hand the group over', function () {
    $creator = userWithRole(Role::USER);
    $member = userWithRole(Role::USER);
    $other = userWithRole(Role::USER);
    $group = startGroupConversation($creator, [$member, $other]);

    $this->actingAs($member, 'sanctum')->patchJson("/api/conversations/{$group}/members/{$other->id}", ['role' => 'admin'])->assertForbidden();
    $this->actingAs($creator, 'sanctum')->patchJson("/api/conversations/{$group}/members/{$creator->id}", ['role' => 'member'])->assertUnprocessable();

    $this->actingAs($creator, 'sanctum')->postJson("/api/conversations/{$group}/transfer", ['user_id' => $member->id])
        ->assertOk()
        ->assertJsonPath('data.my_role', 'admin');

    $this->actingAs($member, 'sanctum')->getJson("/api/conversations/{$group}")
        ->assertJsonPath('data.my_role', 'creator')
        ->assertJsonPath('data.permissions.can_change_roles', true);

    $members = $this->actingAs($member, 'sanctum')->getJson("/api/conversations/{$group}/members")->json('data');
    expect(array_column($members, 'role'))->toBe(['creator', 'admin', 'member']);
});

test('creator and admins edit the group info and photo; members cannot', function () {
    Storage::fake('public');
    $creator = userWithRole(Role::USER);
    $member = userWithRole(Role::USER);
    $group = startGroupConversation($creator, [$member]);

    $this->actingAs($member, 'sanctum')->patchJson("/api/conversations/{$group}", ['title' => 'Mine now'])->assertForbidden();

    Event::fake([ConversationUpdated::class, MessageSent::class]);

    $this->actingAs($creator, 'sanctum')->patchJson("/api/conversations/{$group}", ['title' => 'New name', 'description' => 'About us'])
        ->assertOk()
        ->assertJsonPath('data.title', 'New name')
        ->assertJsonPath('data.description', 'About us');

    $this->actingAs($creator, 'sanctum')->post("/api/conversations/{$group}/avatar", [
        'file' => UploadedFile::fake()->image('team.png', 50, 50),
    ], ['Accept' => 'application/json'])
        ->assertOk()
        ->assertJsonPath('data.avatar', fn ($url) => is_string($url) && str_contains($url, 'chat-avatars'));

    $this->actingAs($creator, 'sanctum')->post("/api/conversations/{$group}/avatar", [
        'file' => UploadedFile::fake()->create('evil.svg', 1, 'image/svg+xml'),
    ], ['Accept' => 'application/json'])->assertUnprocessable();

    $this->actingAs($creator, 'sanctum')->deleteJson("/api/conversations/{$group}/avatar")
        ->assertOk()
        ->assertJsonPath('data.avatar', null);

    Event::assertDispatched(ConversationUpdated::class, fn (ConversationUpdated $event) => $event->title === 'New name');
    Event::assertDispatched(MessageSent::class, fn (MessageSent $event) => ($event->message->meta['system']['event'] ?? null) === 'avatar_changed');
});

test('the conversation details show permissions, settings and stats', function () {
    Storage::fake('public');
    $creator = userWithRole(Role::USER);
    $member = userWithRole(Role::USER);
    $group = startGroupConversation($creator, [$member]);
    sendChatMessage($member, $group, 'see https://example.com');
    $this->actingAs($member, 'sanctum')->postJson("/api/conversations/{$group}/messages", [
        'attachments' => [UploadedFile::fake()->image('a.jpg'), UploadedFile::fake()->create('doc.pdf', 5, 'application/pdf')],
    ])->assertCreated();

    $this->actingAs($member, 'sanctum')->getJson("/api/conversations/{$group}")
        ->assertOk()
        ->assertJsonPath('data.creator.id', $creator->id)
        ->assertJsonPath('data.my_role', 'member')
        ->assertJsonPath('data.permissions.can_edit_info', false)
        ->assertJsonPath('data.permissions.can_post', true)
        ->assertJsonPath('data.settings.is_muted', false)
        ->assertJsonPath('data.stats', ['messages' => 2, 'media' => 1, 'files' => 1, 'voice' => 0, 'links' => 1]);
});

test('in a channel only the creator and admins may post', function () {
    $creator = userWithRole(Role::USER);
    $subscriber = userWithRole(Role::USER);
    $channel = startGroupConversation($creator, [$subscriber], 'channel', 'News');

    $this->actingAs($subscriber, 'sanctum')->postJson("/api/conversations/{$channel}/messages", ['body' => 'hi'])
        ->assertForbidden()
        ->assertJsonPath('code', 'chat.channel_read_only');

    $this->actingAs($subscriber, 'sanctum')->getJson("/api/conversations/{$channel}/summary")->assertJsonPath('data.can_send', false);

    sendChatMessage($creator, $channel, 'announcement');
});
