<?php

use App\Domain\AccessControl\Models\Role;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSession;
use Carbon\Carbon;

test('a user can update their date/time format preferences and it changes how dates render', function () {
    $user = userWithRole(Role::USER);

    $token = $user->createToken('test');

    $session = UserSession::create([
        'user_id' => $user->id,
        'personal_access_token_id' => $token->accessToken->id,
        'logged_in_at' => Carbon::create(2026, 9, 14, 21, 5),
        'last_activity_at' => Carbon::create(2026, 9, 14, 21, 5),
    ]);

    // Re-fetching `$user` between requests matters here: `actingAs()` binds
    // whatever object it's given straight to the auth guard, and
    // `$user->settings` is a cached relation property — reusing the same
    // in-memory object across "requests" in one test process would keep
    // serving the pre-update settings, unlike a real request which always
    // resolves the user fresh from its token.
    $this->actingAs($user, 'sanctum')
        ->putJson('/api/profile/settings', [
            'time_format' => '24h',
            'date_format' => 'Y-m-d',
        ])->assertOk();

    $response24h = $this->actingAs($user->fresh(), 'sanctum')->getJson("/api/sessions/{$session->id}");
    expect($response24h->json('data.logged_in_at'))->toContain('21:05');

    $this->actingAs($user->fresh(), 'sanctum')
        ->putJson('/api/profile/settings', [
            'time_format' => '12h',
            'date_format' => 'd.m.Y',
        ])->assertOk();

    $response12h = $this->actingAs($user->fresh(), 'sanctum')->getJson("/api/sessions/{$session->id}");
    expect($response12h->json('data.logged_in_at'))->toContain('14.09.2026');
    expect($response12h->json('data.logged_in_at'))->toContain('09:05 PM');
});

test('invalid theme/date/time values are rejected', function () {
    $user = userWithRole(Role::USER);

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/profile/settings', ['theme' => 'not-a-real-theme'])
        ->assertUnprocessable();

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/profile/settings', ['time_format' => '25h'])
        ->assertUnprocessable();

    $this->actingAs($user, 'sanctum')
        ->putJson('/api/profile/settings', ['date_format' => 'not-a-format'])
        ->assertUnprocessable();
});

test('a user can fetch their own settings', function () {
    $user = userWithRole(Role::USER);

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/profile/settings')
        ->assertOk();
});
