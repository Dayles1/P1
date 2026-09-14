<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Setting\Models\Setting;

test('a regular user cannot access admin settings', function () {
    $user = userWithRole(Role::USER);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/admin/settings')
        ->assertForbidden();
});

test('an admin can list settings grouped by group', function () {
    $admin = userWithRole(Role::ADMIN);

    $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/settings');

    $response->assertOk();
    expect($response->json('data'))->not->toBeEmpty();
});

test('an admin can update an unlocked setting', function () {
    $admin = userWithRole(Role::ADMIN);
    $setting = Setting::where('key', 'auth.registration_open')->firstOrFail();

    $this->actingAs($admin, 'sanctum')
        ->patchJson("/api/admin/settings/{$setting->id}", ['value' => false, 'operation' => 'set'])
        ->assertOk()
        ->assertJsonPath('data.value', false);

    expect($setting->fresh()->typed_value)->toBeFalse();
});

test('a locked setting rejects updates even from an admin', function () {
    $admin = userWithRole(Role::ADMIN);
    $setting = Setting::where('key', 'auth.protect_superadmin')->firstOrFail();

    $this->actingAs($admin, 'sanctum')
        ->patchJson("/api/admin/settings/{$setting->id}", ['value' => false, 'operation' => 'set'])
        ->assertUnprocessable();
});

test('a guest cannot access admin settings', function () {
    $this->getJson('/api/admin/settings')->assertUnauthorized();
});
