<?php

use App\Domain\Identity\Models\User;

test('a user can update their date/time/theme/locale preferences', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;
    $timezone = timezoneRow('Asia/Tashkent');

    $response = $this->withHeader('Authorization', "Bearer {$token}")
        ->putJson('/api/profile/settings', [
            'timezone_id' => $timezone->id,
            'theme' => 'green',
            'time_format' => '12h',
            'date_format' => 'd.m.Y',
            'locale' => 'ru',
        ]);

    $response->assertOk()
        ->assertJsonPath('data.theme', 'green')
        ->assertJsonPath('data.time_format', '12h')
        ->assertJsonPath('data.date_format', 'd.m.Y')
        ->assertJsonPath('data.locale', 'ru');
});

test('a user can toggle require_login_verification', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $this->withHeader('Authorization', "Bearer {$token}")
        ->putJson('/api/profile/settings', ['require_login_verification' => true])
        ->assertOk()
        ->assertJsonPath('data.require_login_verification', true);

    expect($user->settings()->first()->require_login_verification)->toBeTrue();
});

test('an invalid theme value is rejected', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $this->withHeader('Authorization', "Bearer {$token}")
        ->putJson('/api/profile/settings', ['theme' => 'purple-haze'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('theme');
});

test('the 12h/24h and date format preferences actually change how dates are rendered', function () {
    // Settings are seeded directly (not via a prior HTTP call) so this test
    // isn't tripped up by Laravel's RequestGuard caching the resolved user
    // across multiple simulated requests in one test — that's a testing
    // artifact, not something that happens across real, separate requests.
    $user = User::factory()->create();
    [$token, $session] = createUserSession($user);
    $timezone = timezoneRow('UTC');

    $user->settings()->create([
        'timezone_id' => $timezone->id,
        'time_format' => '12h',
        'date_format' => 'm/d/Y',
    ]);

    $response = $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/sessions');

    $lastActivity = $response->json('data.0.last_activity_at');

    expect($lastActivity)->toMatch('/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} (AM|PM)$/');
});

test('a user can choose the currency they read prices in', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;
    $uzs = currencyRow('UZS', symbol: 'soʻm');

    $this->withHeader('Authorization', "Bearer {$token}")
        ->putJson('/api/profile/settings', ['preferred_currency_id' => $uzs->id])
        ->assertOk()
        ->assertJsonPath('data.currency.code', 'UZS')
        ->assertJsonPath('data.currency.symbol', 'soʻm');

    expect($user->settings()->first()->preferred_currency_id)->toBe($uzs->id);
});

test('clearing the currency falls back to the app one rather than leaving prices unreadable', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;

    $user->settings()->create([
        'user_id' => $user->id,
        'preferred_currency_id' => currencyRow('UZS')->id,
    ]);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->putJson('/api/profile/settings', ['preferred_currency_id' => null])
        ->assertOk()
        ->assertJsonPath('data.currency', null);
});

test('a currency the app has switched off cannot be chosen', function () {
    $user = User::factory()->create();
    $token = $user->createToken('test')->plainTextToken;
    $old = currencyRow('OLD');
    $old->update(['is_active' => false]);

    $this->withHeader('Authorization', "Bearer {$token}")
        ->putJson('/api/profile/settings', ['preferred_currency_id' => $old->id])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('preferred_currency_id');
});
