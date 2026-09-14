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
