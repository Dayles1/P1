<?php

use App\Domain\Identity\Models\RequestLog;
use App\Domain\Identity\Models\User;

test('an API request creates a request log row tied to the caller\'s session', function () {
    $user = User::factory()->create();

    $this->actingAs($user, 'sanctum')->getJson('/api/auth/me')->assertOk();

    $log = RequestLog::query()->where('path', '/api/auth/me')->first();

    expect($log)->not->toBeNull();
    expect($log->user_id)->toBe($user->id);
    expect($log->method)->toBe('GET');
    expect($log->status_code)->toBe(200);
});

test('sensitive fields are redacted before a request log is stored', function () {
    $user = User::factory()->create(['password' => bcrypt('Password123')]);

    $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'Password123',
    ])->assertOk();

    $log = RequestLog::query()->where('path', '/api/auth/login')->first();

    expect($log)->not->toBeNull();
    expect($log->body['password'])->toBe('[REDACTED]');
    expect($log->response_body['data']['token'])->toBe('[REDACTED]');
});
