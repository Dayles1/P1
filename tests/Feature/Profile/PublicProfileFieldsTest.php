<?php

use App\Domain\AccessControl\Models\Role;

test('the profile saves and returns the public fields', function () {
    $user = userWithRole(Role::USER);

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/profile', [
            'position' => 'Head of Product',
            'bio' => 'Releases and roadmaps.',
            'tags' => [' Product ', 'Laravel', ''],
            'phone' => '+998 (90) 123-45-67',
            'phone_visible' => true,
            'telegram' => '@alisher_k',
        ])
        ->assertOk()
        ->assertJsonPath('data.position', 'Head of Product')
        ->assertJsonPath('data.bio', 'Releases and roadmaps.')
        ->assertJsonPath('data.tags', ['Product', 'Laravel'])
        ->assertJsonPath('data.phone', '+998 (90) 123-45-67')
        ->assertJsonPath('data.phone_visible', true)
        ->assertJsonPath('data.telegram', 'alisher_k');

    expect($user->refresh()->profile_tags)->toBe(['Product', 'Laravel'])
        ->and($user->telegram)->toBe('alisher_k');

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/profile')
        ->assertJsonPath('data.tags', ['Product', 'Laravel'])
        ->assertJsonPath('data.phone_visible', true);
});

test('the public fields can be cleared', function () {
    $user = userWithRole(Role::USER, ['position' => 'Dev', 'profile_tags' => ['a'], 'telegram' => 'someone']);

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/profile', ['position' => '', 'tags' => [], 'telegram' => null, 'phone_visible' => false])
        ->assertOk()
        ->assertJsonPath('data.position', null)
        ->assertJsonPath('data.tags', [])
        ->assertJsonPath('data.telegram', null);
});

test('the public fields are validated', function (array $payload, string $field) {
    $this->actingAs(userWithRole(Role::USER), 'sanctum')
        ->patchJson('/api/profile', $payload)
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'long position' => [['position' => str_repeat('a', 121)], 'position'],
    'long bio' => [['bio' => str_repeat('a', 201)], 'bio'],
    'too many tags' => [['tags' => array_map(fn ($i) => "t{$i}", range(1, 9))], 'tags'],
    'long tag' => [['tags' => [str_repeat('a', 25)]], 'tags.0'],
    'duplicate tags' => [['tags' => ['Go', 'go']], 'tags.1'],
    'phone with letters' => [['phone' => '+998 call me'], 'phone'],
    'long phone' => [['phone' => str_repeat('1', 33)], 'phone'],
    'short telegram' => [['telegram' => '@abc'], 'telegram'],
    'telegram link' => [['telegram' => 'https://t.me/someone'], 'telegram'],
    'phone visible not boolean' => [['phone_visible' => 'maybe'], 'phone_visible'],
]);
