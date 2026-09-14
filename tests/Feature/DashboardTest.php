<?php

use App\Domain\Identity\Models\RequestLog;
use App\Domain\Identity\Models\User;

test('the dashboard summary reflects real database state, not placeholders', function () {
    $user = User::factory()->create();
    [$token, $session] = createUserSession($user);

    RequestLog::factory()->count(2)->create([
        'user_id' => $user->id,
        'user_session_id' => $session->id,
        'created_at' => now(),
    ]);

    RequestLog::factory()->create([
        'user_id' => $user->id,
        'user_session_id' => $session->id,
        'status_code' => 500,
        'created_at' => now(),
    ]);

    $response = $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/dashboard');

    $response->assertOk();
    expect($response->json('data.sessions.active'))->toBe(1);
    expect($response->json('data.requests.today'))->toBe(3);
    expect($response->json('data.requests.errors_this_week'))->toBe(1);
    expect($response->json('data.instance'))->toBeNull();
});

test('the dashboard includes an instance overview only for admins', function () {
    $admin = userWithRole('ADMIN');
    [$token] = createUserSession($admin);

    $response = $this->withHeader('Authorization', "Bearer {$token}")->getJson('/api/dashboard');

    $response->assertOk();
    expect($response->json('data.instance.total_users'))->toBe(1);
});
