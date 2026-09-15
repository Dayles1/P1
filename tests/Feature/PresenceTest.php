<?php

use App\Domain\Identity\Models\User;

test('an authenticated request updates last_seen_at', function () {
    $user = User::factory()->create(['last_seen_at' => null]);
    [$token] = createUserSession($user);

    expect($user->last_seen_at)->toBeNull();

    $this->withHeaders(['Authorization' => "Bearer {$token}"])->getJson('/api/auth/me')->assertOk();

    expect($user->fresh()->last_seen_at)->not->toBeNull();
});

test('last_seen_at is not rewritten on every request within the throttle window', function () {
    $user = User::factory()->create(['last_seen_at' => now()->subSeconds(10)]);
    [$token] = createUserSession($user);
    $before = $user->last_seen_at;

    $this->withHeaders(['Authorization' => "Bearer {$token}"])->getJson('/api/auth/me')->assertOk();

    expect($user->fresh()->last_seen_at->eq($before))->toBeTrue();
});

test('the broadcasting auth endpoint requires a bearer token, not a session', function () {
    $this->postJson('/broadcasting/auth', ['channel_name' => 'private-App.Models.User.1'])
        ->assertUnauthorized();
});
