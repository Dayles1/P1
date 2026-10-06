<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Ban\Actions\BanEntity;
use App\Domain\Chat\Models\Conversation;
use App\Domain\Chat\Models\Message;
use App\Domain\Chat\Models\MessageAttachment;
use App\Domain\Chat\Models\MessageUserHide;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserBlock;
use Illuminate\Support\Facades\DB;

function profileGroup(User $creator, array $members, string $title): int
{
    return test()->actingAs($creator, 'sanctum')->postJson('/api/conversations', [
        'type' => 'group', 'title' => $title, 'user_ids' => array_map(fn (User $user) => $user->id, $members),
    ])->json('data.id');
}

function profileMessage(int $conversationId, User $author, ?string $body = 'Hello', array $attributes = []): Message
{
    $message = new Message;
    $message->forceFill([
        'conversation_id' => $conversationId,
        'user_id' => $author->id,
        'type' => Message::TYPE_TEXT,
        'body' => $body,
        ...$attributes,
    ])->save();

    return $message;
}

function profileAttachment(Message $message, string $mime, string $name): MessageAttachment
{
    return MessageAttachment::query()->create([
        'message_id' => $message->id,
        'disk' => 'public',
        'path' => "chat/{$name}",
        'original_name' => $name,
        'mime_type' => $mime,
        'size' => 2048,
    ]);
}

test('a profile carries the public fields and hides a phone its owner hid', function () {
    $viewer = userWithRole(Role::USER);
    $other = userWithRole(Role::USER, [
        'name' => 'Maria',
        'position' => 'Head of Product',
        'bio' => 'Releases and roadmaps.',
        'profile_tags' => ['Product', 'Laravel'],
        'phone' => '+998 90 123-45-67',
        'phone_visible' => false,
        'telegram' => 'maria_k',
    ]);

    $this->actingAs($viewer, 'sanctum')
        ->getJson("/api/users/{$other->id}")
        ->assertOk()
        ->assertJsonPath('data.position', 'Head of Product')
        ->assertJsonPath('data.bio', 'Releases and roadmaps.')
        ->assertJsonPath('data.tags', ['Product', 'Laravel'])
        ->assertJsonPath('data.telegram', 'maria_k')
        ->assertJsonPath('data.phone', null)
        ->assertJsonPath('data.phone_hidden', true)
        ->assertJsonPath('data.is_blocked', false)
        ->assertJsonPath('data.can_message', true)
        ->assertJsonPath('data.reply_time', null)
        ->assertJsonPath('data.common_groups_count', 0)
        ->assertJsonPath('data.mutual_contacts', ['users' => [], 'count' => 0])
        ->assertJsonPath('data.shared.media_count', 0)
        ->assertJsonStructure(['data' => ['joined_at_iso', 'locale', 'timezone', 'last_seen_at', 'recent_activity', 'shared' => ['recent_media', 'recent_files', 'files_count']]]);

    // The owner always sees their own number; a visible number is shown to all.
    $this->actingAs($other, 'sanctum')
        ->getJson("/api/users/{$other->id}")
        ->assertJsonPath('data.phone', '+998 90 123-45-67')
        ->assertJsonPath('data.phone_hidden', false)
        ->assertJsonPath('data.is_me', true)
        ->assertJsonPath('data.can_message', false);

    $other->update(['phone_visible' => true]);

    $this->actingAs($viewer, 'sanctum')
        ->getJson("/api/users/{$other->id}")
        ->assertJsonPath('data.phone', '+998 90 123-45-67')
        ->assertJsonPath('data.phone_hidden', false);
});

test('a profile without a phone is not "hidden"', function () {
    $other = userWithRole(Role::USER);

    $this->actingAs(userWithRole(Role::USER), 'sanctum')
        ->getJson("/api/users/{$other->id}")
        ->assertJsonPath('data.phone', null)
        ->assertJsonPath('data.phone_hidden', false);
});

test('a block shows on the profile and stops messaging', function () {
    $viewer = userWithRole(Role::USER);
    $other = userWithRole(Role::USER);

    UserBlock::query()->create(['user_id' => $viewer->id, 'blocked_user_id' => $other->id]);

    $this->actingAs($viewer, 'sanctum')
        ->getJson("/api/users/{$other->id}")
        ->assertJsonPath('data.is_blocked', true)
        ->assertJsonPath('data.can_message', false);

    $this->actingAs($other, 'sanctum')
        ->getJson("/api/users/{$viewer->id}")
        ->assertJsonPath('data.is_blocked', false)
        ->assertJsonPath('data.can_message', false);
});

test('mutual contacts are the other members of the common groups', function () {
    $viewer = userWithRole(Role::USER);
    $other = userWithRole(Role::USER);
    $anna = userWithRole(Role::USER, ['name' => 'Anna']);
    $bob = userWithRole(Role::USER, ['name' => 'Bob']);
    $outsider = userWithRole(Role::USER, ['name' => 'Outsider']);

    profileGroup($viewer, [$other, $anna, $bob], 'Team');
    profileGroup($viewer, [$outsider], 'Elsewhere');

    $response = $this->actingAs($viewer, 'sanctum')->getJson("/api/users/{$other->id}")->assertOk();

    expect($response->json('data.mutual_contacts.count'))->toBe(2)
        ->and(array_column($response->json('data.mutual_contacts.users'), 'name'))->toBe(['Anna', 'Bob'])
        ->and($response->json('data.common_groups_count'))->toBe(1)
        ->and($response->json('data.common_groups.0.type'))->toBe(Conversation::TYPE_GROUP);
});

test('shared media and files only come from conversations both are current members of', function () {
    $viewer = userWithRole(Role::USER);
    $other = userWithRole(Role::USER);
    $third = userWithRole(Role::USER);

    $privateId = startPrivateConversation($viewer, $other);
    $sharedGroupId = profileGroup($viewer, [$other], 'Shared');
    $foreignGroupId = profileGroup($other, [$third], 'Not mine');
    $leftGroupId = profileGroup($viewer, [$other], 'Left');

    $photo = profileAttachment(profileMessage($privateId, $other), 'image/png', 'photo.png');
    $contract = profileAttachment(profileMessage($sharedGroupId, $other), 'application/pdf', 'contract.pdf');
    profileAttachment(profileMessage($sharedGroupId, $viewer), 'audio/webm', 'voice.webm');
    profileAttachment(profileMessage($foreignGroupId, $other), 'image/png', 'secret.png');
    profileAttachment(profileMessage($foreignGroupId, $other), 'application/pdf', 'secret.pdf');
    profileAttachment(profileMessage($leftGroupId, $other), 'application/pdf', 'before-leaving.pdf');

    DB::table('conversation_users')
        ->where('conversation_id', $leftGroupId)
        ->where('user_id', $viewer->id)
        ->update(['left_at' => now()]);

    $deleted = profileMessage($sharedGroupId, $other);
    profileAttachment($deleted, 'image/jpeg', 'deleted.jpg');
    $deleted->delete();

    $hidden = profileMessage($sharedGroupId, $other);
    profileAttachment($hidden, 'image/jpeg', 'hidden.jpg');
    MessageUserHide::query()->create(['message_id' => $hidden->id, 'user_id' => $viewer->id]);

    $profile = $this->actingAs($viewer, 'sanctum')->getJson("/api/users/{$other->id}")->assertOk();

    expect($profile->json('data.shared.media_count'))->toBe(1)
        ->and($profile->json('data.shared.files_count'))->toBe(1)
        ->and(array_column($profile->json('data.shared.recent_media'), 'id'))->toBe([$photo->id])
        ->and($profile->json('data.shared.recent_media.0.kind'))->toBe('image')
        ->and(array_column($profile->json('data.shared.recent_files'), 'original_name'))->toBe(['contract.pdf']);

    $media = $this->actingAs($viewer, 'sanctum')->getJson("/api/users/{$other->id}/shared?kind=media")->assertOk();
    $files = $this->actingAs($viewer, 'sanctum')->getJson("/api/users/{$other->id}/shared?kind=files")->assertOk();
    $voice = $this->actingAs($viewer, 'sanctum')->getJson("/api/users/{$other->id}/shared?kind=voice")->assertOk();

    expect(array_column($media->json('data'), 'original_name'))->toBe(['photo.png'])
        ->and(array_column($files->json('data'), 'id'))->toBe([$contract->id])
        ->and(array_column($voice->json('data'), 'original_name'))->toBe(['voice.webm'])
        ->and($media->json('pagination.per_page'))->toBe(24);

    // The third person shares only the foreign group with the other user.
    $theirs = $this->actingAs($third, 'sanctum')->getJson("/api/users/{$other->id}/shared?kind=files")->assertOk();

    expect(array_column($theirs->json('data'), 'original_name'))->toBe(['secret.pdf']);
});

test('history cleared by the viewer is not shared any more', function () {
    $viewer = userWithRole(Role::USER);
    $other = userWithRole(Role::USER);
    $privateId = startPrivateConversation($viewer, $other);

    $old = profileMessage($privateId, $other);
    profileAttachment($old, 'image/png', 'old.png');

    DB::table('conversation_users')
        ->where('conversation_id', $privateId)
        ->where('user_id', $viewer->id)
        ->update(['cleared_up_to_message_id' => $old->id]);

    profileAttachment(profileMessage($privateId, $other), 'image/png', 'new.png');

    $media = $this->actingAs($viewer, 'sanctum')->getJson("/api/users/{$other->id}/shared")->assertOk();

    expect(array_column($media->json('data'), 'original_name'))->toBe(['new.png']);
});

test('shared links list messages with URLs', function () {
    $viewer = userWithRole(Role::USER);
    $other = userWithRole(Role::USER);
    $privateId = startPrivateConversation($viewer, $other);

    profileMessage($privateId, $other, 'See https://example.com/spec and tell me');
    profileMessage($privateId, $other, 'No link here');

    $links = $this->actingAs($viewer, 'sanctum')->getJson("/api/users/{$other->id}/shared?kind=links")->assertOk();

    expect($links->json('data'))->toHaveCount(1)
        ->and($links->json('data.0.url'))->toBe('https://example.com/spec');
});

test('the shared endpoint validates the kind and hides banned users', function () {
    $viewer = userWithRole(Role::USER);
    $other = userWithRole(Role::USER);

    $this->actingAs($viewer, 'sanctum')->getJson("/api/users/{$other->id}/shared?kind=nope")->assertUnprocessable();

    app(BanEntity::class)->handle($other, reason: 'test');

    $this->actingAs($viewer, 'sanctum')->getJson("/api/users/{$other->id}/shared")->assertNotFound();
});

test('recent activity comes only from shared conversations', function () {
    $viewer = userWithRole(Role::USER);
    $other = userWithRole(Role::USER);
    $third = userWithRole(Role::USER);

    $createdId = profileGroup($other, [$viewer], 'Marketing');
    $joinedId = profileGroup($viewer, [$other], 'Support');
    $foreignId = profileGroup($other, [$third], 'Secret');

    profileMessage($joinedId, $other, 'Hi @[Anna](5), the release is out');
    profileMessage($foreignId, $other, 'Top secret');

    $activity = $this->actingAs($viewer, 'sanctum')
        ->getJson("/api/users/{$other->id}")
        ->assertOk()
        ->json('data.recent_activity');

    $kinds = collect($activity)->map(fn (array $item) => $item['kind'].':'.($item['conversation']['id'] ?? ''))->all();

    expect($kinds)->toContain("group_created:{$createdId}")
        ->and($kinds)->toContain("group_joined:{$joinedId}")
        ->and($kinds)->toContain("message:{$joinedId}")
        ->and(collect($activity)->pluck('conversation.id'))->not->toContain($foreignId)
        ->and(collect($activity)->firstWhere('kind', 'message')['text'])->toBe('Hi @Anna, the release is out')
        ->and($activity[0])->toHaveKeys(['kind', 'at_iso', 'conversation', 'text']);
});

test('reply time is bucketed from private chat delays and needs three replies', function () {
    $viewer = userWithRole(Role::USER);
    $other = userWithRole(Role::USER);
    $privateId = startPrivateConversation($viewer, $other);

    $start = now()->subDays(2);

    foreach ([0, 1] as $round) {
        profileMessage($privateId, $viewer, 'Question', ['created_at' => $start->clone()->addHours($round * 3)]);
        profileMessage($privateId, $other, 'Answer', ['created_at' => $start->clone()->addHours($round * 3)->addMinutes(40)]);
    }

    $this->actingAs($viewer, 'sanctum')->getJson("/api/users/{$other->id}")->assertJsonPath('data.reply_time', null);

    cache()->flush();
    profileMessage($privateId, $viewer, 'Question', ['created_at' => $start->clone()->addHours(9)]);
    profileMessage($privateId, $other, 'Answer', ['created_at' => $start->clone()->addHours(9)->addMinutes(50)]);

    $this->actingAs($viewer, 'sanctum')->getJson("/api/users/{$other->id}")->assertJsonPath('data.reply_time', 'hour');
});

test('a profile is built without a query per group or attachment', function () {
    $viewer = userWithRole(Role::USER);
    $other = userWithRole(Role::USER);
    $privateId = startPrivateConversation($viewer, $other);

    foreach (range(1, 3) as $index) {
        profileGroup($viewer, [$other, userWithRole(Role::USER)], "Group {$index}");
        profileAttachment(profileMessage($privateId, $other), 'image/png', "p{$index}.png");
        profileAttachment(profileMessage($privateId, $other), 'application/pdf', "f{$index}.pdf");
    }

    $this->actingAs($viewer, 'sanctum')->getJson("/api/users/{$other->id}")->assertOk();

    DB::enableQueryLog();
    $this->actingAs($viewer, 'sanctum')->getJson("/api/users/{$other->id}")->assertOk();
    $few = count(DB::getQueryLog());

    foreach (range(4, 8) as $index) {
        profileGroup($viewer, [$other, userWithRole(Role::USER)], "Group {$index}");
        profileAttachment(profileMessage($privateId, $other), 'image/png', "p{$index}.png");
    }

    DB::flushQueryLog();
    $this->actingAs($viewer, 'sanctum')->getJson("/api/users/{$other->id}")->assertOk();

    expect(count(DB::getQueryLog()))->toBe($few);
});
