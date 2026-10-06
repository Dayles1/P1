<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Chat\Events\ConversationUpdated;
use App\Domain\Chat\Events\MessageEdited;
use App\Domain\Chat\Events\PollUpdated;
use App\Domain\Chat\Events\UserTyping;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Services\HostResolver;
use App\Domain\Chat\Services\LinkPreviews;
use App\Domain\Identity\Models\UserBlock;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

test('a poll can be voted on, the vote changed or taken back, and closed by its author', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $group = startGroupConversation($alice, [$bob]);

    $poll = $this->actingAs($alice, 'sanctum')->postJson("/api/conversations/{$group}/polls", [
        'question' => 'Where?', 'options' => ['Here', 'There', 'Anywhere'],
    ])
        ->assertCreated()
        ->assertJsonPath('data.type', 'poll')
        ->assertJsonPath('data.poll.options.2.text', 'Anywhere')
        ->json('data');

    Event::fake([PollUpdated::class, MessageEdited::class]);

    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$group}/messages/{$poll['id']}/vote", ['option_ids' => [0, 1]])
        ->assertUnprocessable();

    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$group}/messages/{$poll['id']}/vote", ['option_ids' => [1]])
        ->assertOk()
        ->assertJsonPath('data.poll.options.1.votes', 1)
        ->assertJsonPath('data.poll.my_votes', [1])
        ->assertJsonPath('data.poll.total_voters', 1);

    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$group}/messages/{$poll['id']}/vote", ['option_ids' => [2]])
        ->assertJsonPath('data.poll.options.1.votes', 0)
        ->assertJsonPath('data.poll.my_votes', [2]);

    $this->actingAs($bob, 'sanctum')->deleteJson("/api/conversations/{$group}/messages/{$poll['id']}/vote")
        ->assertJsonPath('data.poll.total_voters', 0);

    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$group}/messages/{$poll['id']}/close")->assertForbidden();
    $this->actingAs($alice, 'sanctum')->postJson("/api/conversations/{$group}/messages/{$poll['id']}/close")
        ->assertOk()
        ->assertJsonPath('data.poll.closed', true);

    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$group}/messages/{$poll['id']}/vote", ['option_ids' => [0]])
        ->assertUnprocessable();

    Event::assertDispatched(PollUpdated::class, fn (PollUpdated $event) => ! array_key_exists('my_votes', $event->poll) && count($event->userIds) === 2);
    Event::assertDispatched(MessageEdited::class);
});

test('a multiple-answer poll takes several options and validates them', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);

    $pollId = $this->actingAs($alice, 'sanctum')->postJson("/api/conversations/{$chat}/polls", [
        'question' => 'Which days?', 'options' => ['Mon', 'Tue'], 'multiple' => true,
    ])->json('data.id');

    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$chat}/messages/{$pollId}/vote", ['option_ids' => [0, 1]])
        ->assertOk()
        ->assertJsonPath('data.poll.my_votes', [0, 1]);

    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$chat}/messages/{$pollId}/vote", ['option_ids' => [5]])
        ->assertUnprocessable();

    $this->actingAs($alice, 'sanctum')->postJson("/api/conversations/{$chat}/polls", ['question' => 'One?', 'options' => ['only']])
        ->assertUnprocessable();
});

test('blocking someone stops both of you writing in your private chat', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);

    Event::fake([ConversationUpdated::class]);

    $this->actingAs($alice, 'sanctum')->postJson("/api/users/{$bob->id}/block")
        ->assertOk()
        ->assertJsonPath('data.is_blocked', true);

    Event::assertDispatched(ConversationUpdated::class, fn (ConversationUpdated $event) => $event->reason === 'blocked' && $event->conversationId === $chat);

    $this->actingAs($bob, 'sanctum')->postJson("/api/conversations/{$chat}/messages", ['body' => 'hey'])
        ->assertForbidden()
        ->assertJsonPath('code', 'chat.blocked');
    $this->actingAs($alice, 'sanctum')->postJson("/api/conversations/{$chat}/messages", ['body' => 'hey'])
        ->assertForbidden();

    $this->actingAs($alice, 'sanctum')->getJson("/api/conversations/{$chat}/summary")
        ->assertJsonPath('data.is_blocked', true)
        ->assertJsonPath('data.can_send', false);
    $this->actingAs($bob, 'sanctum')->getJson("/api/conversations/{$chat}/summary")
        ->assertJsonPath('data.is_blocked', false)
        ->assertJsonPath('data.can_send', false);

    $this->actingAs($alice, 'sanctum')->getJson('/api/users/blocked')
        ->assertOk()
        ->assertJsonPath('data.0.id', $bob->id);

    $this->actingAs($alice, 'sanctum')->deleteJson("/api/users/{$bob->id}/block")->assertJsonPath('data.is_blocked', false);

    sendChatMessage($bob, $chat, 'hello again');
    expect(UserBlock::query()->count())->toBe(0);
});

test('you cannot block yourself, and blocking twice is harmless', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);

    $this->actingAs($alice, 'sanctum')->postJson("/api/users/{$alice->id}/block")->assertUnprocessable();
    $this->actingAs($alice, 'sanctum')->postJson("/api/users/{$bob->id}/block")->assertOk();
    $this->actingAs($alice, 'sanctum')->postJson("/api/users/{$bob->id}/block")->assertOk();

    expect(UserBlock::query()->count())->toBe(1);
});

test('typing says what kind of activity it is and skips the typer', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);

    Event::fake([UserTyping::class]);

    $this->actingAs($alice, 'sanctum')->postJson("/api/conversations/{$chat}/typing", ['kind' => 'recording'])->assertOk();
    $this->actingAs($alice, 'sanctum')->postJson("/api/conversations/{$chat}/typing", ['kind' => 'dancing'])->assertUnprocessable();

    Event::assertDispatched(UserTyping::class, fn (UserTyping $event) => $event->kind === 'recording'
        && $event->userIds === [$bob->id]
        && $event->broadcastWith()['kind'] === 'recording');
});

test('search filters by sender and date and tells which chat each hit is in', function () {
    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER, ['name' => 'Bob']);
    $chat = startPrivateConversation($alice, $bob);

    $this->travelTo(now()->subDays(3));
    sendChatMessage($bob, $chat, 'old report');
    $this->travelBack();
    sendChatMessage($bob, $chat, 'new report');
    sendChatMessage($alice, $chat, 'my report');

    $bySender = $this->actingAs($alice, 'sanctum')->getJson("/api/messages/search?q=report&sender_id={$bob->id}")->assertOk();
    expect(array_column($bySender->json('data'), 'body'))->toBe(['new report', 'old report'])
        ->and($bySender->json('data.0.conversation'))->toBe(['id' => $chat, 'type' => 'private', 'title' => 'Bob']);

    $recent = $this->actingAs($alice, 'sanctum')->getJson('/api/messages/search?q=report&date_from='.now()->subDay()->toDateString())->assertOk();
    expect(array_column($recent->json('data'), 'body'))->toBe(['my report', 'new report']);

    // Wildcards are literal.
    expect($this->actingAs($alice, 'sanctum')->getJson('/api/messages/search?q=%25')->json('data'))->toBe([]);
});

test('a link gets a preview card after the response, sent as message.edited', function () {
    $this->app->instance(HostResolver::class, new class extends HostResolver
    {
        public function resolve(string $host): array
        {
            return ['93.184.216.34'];
        }
    });

    Http::fake([
        'https://example.com/*' => Http::response(
            '<html><head><title>Fallback</title><meta property="og:title" content="Example &amp; Co"><meta property="og:description" content="A page"><meta property="og:image" content="/img.png"></head></html>',
            200,
            ['Content-Type' => 'text/html; charset=utf-8'],
        ),
    ]);

    Event::fake([MessageEdited::class]);

    $alice = userWithRole(Role::USER);
    $bob = userWithRole(Role::USER);
    $chat = startPrivateConversation($alice, $bob);
    $messageId = sendChatMessage($alice, $chat, 'look https://example.com/page.');

    $preview = Message::query()->find($messageId)->meta['link_preview'];

    expect($preview)->toMatchArray([
        'url' => 'https://example.com/page',
        'title' => 'Example & Co',
        'description' => 'A page',
        'image_url' => 'https://example.com/img.png',
        'site_name' => 'example.com',
    ]);

    Event::assertDispatched(MessageEdited::class, fn (MessageEdited $event) => $event->message->id === $messageId);
});

test('link previews never reach private or local addresses', function (string $url, array $addresses) {
    $this->app->instance(HostResolver::class, new class($addresses) extends HostResolver
    {
        public function __construct(private array $addresses) {}

        public function resolve(string $host): array
        {
            return $this->addresses;
        }
    });

    Http::fake();

    expect(app(LinkPreviews::class)->fetch($url))->toBeNull();
    Http::assertNothingSent();
})->with([
    'loopback' => ['http://localhost/', ['127.0.0.1']],
    'private network' => ['http://intranet.test/', ['10.0.0.5']],
    'metadata service' => ['http://metadata.test/latest', ['169.254.169.254']],
    'one bad address among good ones' => ['http://mixed.test/', ['93.184.216.34', '192.168.1.1']],
    'odd port' => ['http://example.com:8080/', ['93.184.216.34']],
    'not http' => ['ftp://example.com/', ['93.184.216.34']],
    'credentials in the url' => ['http://user:pass@example.com/', ['93.184.216.34']],
]);

test('a redirect to a private address is not followed', function () {
    $this->app->instance(HostResolver::class, new class extends HostResolver
    {
        public function resolve(string $host): array
        {
            return $host === 'example.com' ? ['93.184.216.34'] : ['127.0.0.1'];
        }
    });

    Http::fake([
        'https://example.com/*' => Http::response('', 302, ['Location' => 'http://internal.test/admin']),
        '*' => Http::response('<title>secret</title>', 200, ['Content-Type' => 'text/html']),
    ]);

    expect(app(LinkPreviews::class)->fetch('https://example.com/go'))->toBeNull();
    Http::assertSentCount(1);
});
