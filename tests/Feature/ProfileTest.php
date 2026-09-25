<?php

use App\Domain\Identity\Models\User;

test('a user can fetch their profile with their timezone and currency', function () {
    $user = User::factory()->create();
    $user->settings()->create([
        'timezone_id' => timezoneRow('Asia/Tashkent')->id,
        'preferred_currency_id' => currencyRow('UZS', decimals: 0)->id,
    ]);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/profile')
        ->assertOk()
        ->assertJsonPath('data.settings.timezone.name', 'Asia/Tashkent')
        ->assertJsonPath('data.settings.currency.code', 'UZS');
});

/*
 * UpdateProfile returns `$user->refresh()`, which reloads the `settings`
 * relation SetLocale already pulled in — but not the relations *inside*
 * it. The settings resource has to survive that on its own, so this is
 * the case that guards it directly rather than through an eager load.
 */
test('updating a profile does not blow up on settings with no currency', function () {
    $user = User::factory()->create(['name' => 'Original Name']);
    $user->settings()->create(['locale' => 'en']);

    $this->actingAs($user, 'sanctum')
        ->patchJson('/api/profile', ['name' => 'Renamed User'])
        ->assertOk()
        ->assertJsonPath('data.name', 'Renamed User')
        ->assertJsonPath('data.settings.currency', null)
        ->assertJsonPath('data.settings.timezone', null);
});
