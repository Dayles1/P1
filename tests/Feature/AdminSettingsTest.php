<?php

use App\Domain\Identity\Models\User;
use App\Domain\Setting\Models\Setting;

test('an admin can list settings grouped by category', function () {
    $admin = userWithRole('ADMIN');
    [$token] = createUserSession($admin);

    $response = $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/admin/settings');

    $response->assertOk();
    expect($response->json('data'))->not->toBeEmpty();
    expect($response->json('data.0'))->toHaveKeys(['group', 'items']);
});

test('a non-admin cannot list or update settings', function () {
    $user = User::factory()->create();
    [$token] = createUserSession($user);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->getJson('/api/admin/settings')
        ->assertForbidden();

    $setting = Setting::where('key', 'auth.registration_open')->firstOrFail();

    $this->withHeader('Authorization', "Bearer {$token}")
        ->patchJson("/api/admin/settings/{$setting->id}", ['value' => false])
        ->assertForbidden();
});

test('an admin can toggle a boolean setting', function () {
    $admin = userWithRole('ADMIN');
    [$token] = createUserSession($admin);

    $setting = Setting::where('key', 'auth.registration_open')->firstOrFail();

    $this->withHeader('Authorization', "Bearer {$token}")
        ->patchJson("/api/admin/settings/{$setting->id}", ['value' => false, 'operation' => 'set'])
        ->assertOk()
        ->assertJsonPath('data.value', false);

    expect(Setting::find($setting->id)->typed_value)->toBeFalse();
});

test('a locked setting rejects updates even from an admin', function () {
    $admin = userWithRole('ADMIN');
    [$token] = createUserSession($admin);

    $setting = Setting::where('key', 'auth.protect_superadmin')->firstOrFail();
    expect($setting->is_locked)->toBeTrue();

    $this->withHeader('Authorization', "Bearer {$token}")
        ->patchJson("/api/admin/settings/{$setting->id}", ['value' => false])
        ->assertUnprocessable();
});

test('when registration is closed, register returns an error', function () {
    Setting::where('key', 'auth.registration_open')->update(['value' => '0']);

    $this->postJson('/api/auth/register', [
        'name' => 'New User',
        'email' => 'new@example.com',
        'password' => 'Password123',
        'password_confirmation' => 'Password123',
    ])->assertForbidden();
});
