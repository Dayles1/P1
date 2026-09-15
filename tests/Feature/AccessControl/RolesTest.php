<?php

use App\Domain\Identity\Models\User;

test('roles endpoint requires authentication', function () {
    $this->getJson('/api/roles')->assertUnauthorized();
});

test('roles endpoint lists every role with a localized name and code', function () {
    $user = User::factory()->create();
    [$token] = createUserSession($user);

    $response = $this->withHeaders(['Authorization' => "Bearer {$token}"])
        ->getJson('/api/roles')
        ->assertOk();

    $response->assertJsonFragment(['code' => 'SUPER_ADMIN', 'name' => 'Super Admin'])
        ->assertJsonFragment(['code' => 'ADMIN', 'name' => 'Admin'])
        ->assertJsonFragment(['code' => 'USER', 'name' => 'User']);
});

test('roles endpoint returns the locale-specific name', function () {
    $user = User::factory()->create();
    [$token] = createUserSession($user);

    $response = $this->withHeaders(['Authorization' => "Bearer {$token}", 'X-Locale' => 'ru'])
        ->getJson('/api/roles')
        ->assertOk();

    $response->assertJsonFragment(['code' => 'ADMIN', 'name' => 'Администратор']);
});
