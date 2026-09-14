<?php

use App\Domain\Ban\Actions\BanEntity;
use App\Domain\Identity\Models\User;

test('a user can register with a valid payload', function () {
    $response = $this->postJson('/api/auth/register', [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'Password123',
        'password_confirmation' => 'Password123',
    ]);

    $response->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.user.email', 'test@example.com');

    $this->assertDatabaseHas('users', ['email' => 'test@example.com']);
});

test('registration fails with a mismatched password confirmation', function () {
    $response = $this->postJson('/api/auth/register', [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'Password123',
        'password_confirmation' => 'Different123',
    ]);

    $response->assertUnprocessable()->assertJsonValidationErrors('password');
});

test('a user can log in with correct credentials and receives a bearer token', function () {
    $user = User::factory()->create(['password' => bcrypt('Password123')]);

    $response = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'Password123',
    ]);

    $response->assertOk()->assertJsonPath('success', true);
    expect($response->json('data.token'))->not->toBeEmpty();

    $this->assertDatabaseHas('user_sessions', ['user_id' => $user->id]);
});

test('login fails with incorrect credentials', function () {
    $user = User::factory()->create(['password' => bcrypt('Password123')]);

    $response = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $response->assertUnprocessable()->assertJsonValidationErrors('email');
});

test('a banned user cannot log in', function () {
    $user = User::factory()->create(['password' => bcrypt('Password123')]);

    app(BanEntity::class)->handle($user, reason: 'testing');

    $response = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'Password123',
    ]);

    $response->assertStatus(422);
});

test('an authenticated user can fetch their own profile via /auth/me', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $response = $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/auth/me');

    $response->assertOk()->assertJsonPath('data.user.id', $user->id);
});

test('an unauthenticated request to a protected endpoint is rejected', function () {
    $this->getJson('/api/auth/me')->assertUnauthorized();
});

test('logout revokes the current session', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test');

    $this->withHeader('Authorization', "Bearer {$token->plainTextToken}")
        ->postJson('/api/auth/logout')
        ->assertOk();

    $this->assertDatabaseCount('personal_access_tokens', 0);
});
