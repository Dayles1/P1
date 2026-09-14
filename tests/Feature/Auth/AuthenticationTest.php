<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Ban\Actions\BanEntity;
use App\Domain\Identity\Models\User;
use App\Domain\Setting\Models\Setting;

test('a user can register, receiving no token (must log in separately)', function () {
    $response = $this->postJson('/api/auth/register', [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
        'password' => 'Password123',
        'password_confirmation' => 'Password123',
    ]);

    $response->assertOk();
    $response->assertJsonPath('success', true);
    $response->assertJsonPath('data.user.email', 'jane@example.com');

    $user = User::where('email', 'jane@example.com')->first();

    expect($user)->not->toBeNull();
    expect($user->hasRole(Role::USER))->toBeTrue();
});

test('registration is rejected when auth.registration_open is false', function () {
    Setting::where('key', 'auth.registration_open')->update(['value' => '0']);

    $this->postJson('/api/auth/register', [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
        'password' => 'Password123',
        'password_confirmation' => 'Password123',
    ])->assertForbidden();
});

test('a registered user can log in and receive a bearer token', function () {
    $user = User::factory()->create(['password' => bcrypt('Password123')]);
    $user->assignRole(Role::USER);

    $response = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'Password123',
    ]);

    $response->assertOk();
    $response->assertJsonStructure(['data' => ['user', 'token']]);
});

test('login fails with the wrong password', function () {
    $user = User::factory()->create(['password' => bcrypt('Password123')]);

    $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
    ])->assertUnprocessable();
});

test('a banned user cannot log in', function () {
    $user = User::factory()->create(['password' => bcrypt('Password123')]);

    app(BanEntity::class)->handle($user, reason: 'test ban');

    $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'Password123',
    ])->assertUnprocessable();
});

test('login is rejected when auth.login_open is false', function () {
    Setting::where('key', 'auth.login_open')->update(['value' => '0']);

    $user = User::factory()->create(['password' => bcrypt('Password123')]);

    $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'Password123',
    ])->assertForbidden();
});

test('an authenticated user can fetch their own profile via /auth/me', function () {
    $user = User::factory()->create();
    $user->assignRole(Role::USER);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/auth/me')
        ->assertOk()
        ->assertJsonPath('data.user.email', $user->email);
});

test('a guest cannot access /auth/me', function () {
    $this->getJson('/api/auth/me')->assertUnauthorized();
});
