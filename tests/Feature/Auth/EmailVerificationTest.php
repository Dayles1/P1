<?php

use App\Domain\Identity\Models\User;
use App\Domain\Identity\Notifications\VerifyEmailWithCode;
use App\Domain\Setting\Models\Setting;
use Illuminate\Support\Facades\Notification;

function capturedVerificationCode(User $user): string
{
    $code = null;

    Notification::assertSentTo($user, VerifyEmailWithCode::class, function (VerifyEmailWithCode $notification) use (&$code) {
        $code = (fn () => $this->code)->call($notification);

        return true;
    });

    return $code;
}

beforeEach(function () {
    Setting::where('key', 'auth.email_verification_required')->update(['value' => '1']);
});

test('a freshly registered user has no bearer token but can verify by code via the challenge token', function () {
    Notification::fake();

    $response = $this->postJson('/api/auth/register', [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
        'password' => 'Password123',
        'password_confirmation' => 'Password123',
    ]);

    $response->assertOk();
    $response->assertJsonPath('data.user.email_verified', false);

    $challengeToken = $response->json('data.email_challenge_token');
    expect($challengeToken)->toBeString()->not->toBeEmpty();

    $user = User::where('email', 'jane@example.com')->first();
    $code = capturedVerificationCode($user);

    // No Authorization header at all — this is the exact "no token yet" case.
    $verify = $this->postJson('/api/auth/email/verify-code', [
        'code' => $code,
        'challenge_token' => $challengeToken,
    ]);

    $verify->assertOk();
    $verify->assertJsonPath('data.verified', true);

    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
});

test('verifying by code with the wrong code fails and leaves the account unverified', function () {
    Notification::fake();

    $response = $this->postJson('/api/auth/register', [
        'name' => 'Jane Doe',
        'email' => 'jane@example.com',
        'password' => 'Password123',
        'password_confirmation' => 'Password123',
    ]);

    $challengeToken = $response->json('data.email_challenge_token');
    $user = User::where('email', 'jane@example.com')->first();

    $this->postJson('/api/auth/email/verify-code', [
        'code' => '000000',
        'challenge_token' => $challengeToken,
    ])->assertUnprocessable();

    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
});

test('an already-authenticated unverified user can verify by code without a challenge token', function () {
    Notification::fake();

    $user = User::factory()->create(); // email_verified_at is null by default
    $user->sendEmailVerificationCode();

    $code = capturedVerificationCode($user);

    $this->actingAs($user, 'sanctum')
        ->postJson('/api/auth/email/verify-code', ['code' => $code])
        ->assertOk()
        ->assertJsonPath('data.verified', true);

    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
});
