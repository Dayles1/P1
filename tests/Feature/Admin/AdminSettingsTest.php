<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Identity\Models\User;
use App\Domain\Setting\Models\Setting;
use App\Domain\Setting\Services\SettingService;
use App\Domain\Setting\Services\UserDateFormatter;
use App\Providers\AppServiceProvider;

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

test('a required string setting rejects an empty value with a clean validation error', function () {
    $admin = userWithRole(Role::ADMIN);
    $setting = Setting::where('key', 'system.site_name')->firstOrFail();

    expect($setting->is_required)->toBeTrue();

    $this->actingAs($admin, 'sanctum')
        ->patchJson("/api/admin/settings/{$setting->id}", ['value' => '', 'operation' => 'set'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('value');
});

test('a non-required string setting can be cleared to empty', function () {
    $admin = userWithRole(Role::ADMIN);
    $setting = Setting::where('key', 'system.favicon')->firstOrFail();

    expect($setting->is_required)->toBeFalse();

    $this->actingAs($admin, 'sanctum')
        ->patchJson("/api/admin/settings/{$setting->id}", ['value' => '', 'operation' => 'set'])
        ->assertOk()
        ->assertJsonPath('data.value', '');
});

test('updating site_name overrides config(app.name) instance-wide', function () {
    $admin = userWithRole(Role::ADMIN);
    $setting = Setting::where('key', 'system.site_name')->firstOrFail();

    $this->actingAs($admin, 'sanctum')
        ->patchJson("/api/admin/settings/{$setting->id}", ['value' => 'Acme Corp', 'operation' => 'set'])
        ->assertOk();

    // Re-boot the provider's override the way a fresh request would.
    app(SettingService::class)->forget();
    (new AppServiceProvider(app()))->boot();

    expect(config('app.name'))->toBe('Acme Corp');
});

test('updating fallback_locale overrides config(app.fallback_locale) instance-wide', function () {
    $admin = userWithRole(Role::ADMIN);
    $setting = Setting::where('key', 'localization.fallback_locale')->firstOrFail();

    $this->actingAs($admin, 'sanctum')
        ->patchJson("/api/admin/settings/{$setting->id}", ['value' => 'ru', 'operation' => 'set'])
        ->assertOk();

    (new AppServiceProvider(app()))->boot();

    expect(config('app.fallback_locale'))->toBe('ru');
});

test('system.timezone is used as the fallback for a user with no personal timezone', function () {
    $admin = userWithRole(Role::ADMIN);
    $setting = Setting::where('key', 'system.timezone')->firstOrFail();

    expect($setting->is_locked)->toBeFalse();

    $this->actingAs($admin, 'sanctum')
        ->patchJson("/api/admin/settings/{$setting->id}", ['value' => 'Asia/Tashkent', 'operation' => 'set'])
        ->assertOk();

    $user = User::factory()->create();

    expect(app(UserDateFormatter::class)->resolveTimezone($user))
        ->toBe('Asia/Tashkent');
});

test('an admin can update the allowed login roles as an array of ids', function () {
    $admin = userWithRole(Role::ADMIN);
    $userRole = Role::where('code', Role::USER)->firstOrFail();
    $setting = Setting::where('key', 'auth.allowed_login_role_ids')->firstOrFail();

    $this->actingAs($admin, 'sanctum')
        ->patchJson("/api/admin/settings/{$setting->id}", [
            'value' => [$userRole->id],
            'operation' => 'set',
        ])
        ->assertOk()
        ->assertJsonPath('data.value', [$userRole->id]);

    expect($setting->fresh()->typed_value)->toBe([$userRole->id]);
});

test('a guest cannot access admin settings', function () {
    $this->getJson('/api/admin/settings')->assertUnauthorized();
});
