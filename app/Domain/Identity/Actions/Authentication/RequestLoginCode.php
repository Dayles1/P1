<?php

namespace App\Domain\Identity\Actions\Authentication;

use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\VerificationCode;
use App\Domain\Identity\Notifications\VerificationCodeNotification;
use App\Domain\Identity\Services\VerificationCodeService;
use App\Domain\Setting\Services\SettingService;
use Illuminate\Support\Str;

/**
 * Passwordless login, step 1: request a code by email. Always returns the
 * same shape regardless of whether the email exists — an unknown email
 * gets a decoy challenge token that can never verify, rather than a
 * different response, so this endpoint can't be used to enumerate
 * accounts.
 */
class RequestLoginCode
{
    public function __construct(
        private readonly SettingService $settings,
        private readonly VerificationCodeService $verificationCodes,
    ) {}

    public function handle(string $email, ?string $ipAddress = null, ?string $userAgent = null): string
    {
        if (! $this->settings->boolean('auth.login_open', true)) {
            abort(403, __('auth.login_closed'));
        }

        $user = User::query()
            ->with(['department.ban', 'ban'])
            ->where('email', $email)
            ->first();

        if (! $user) {
            // No row is persisted for a decoy — there is nothing to look
            // up later, so verification of this token always fails with
            // the same generic "invalid code" response a real wrong code
            // would produce.
            return Str::random(48);
        }

        if ($user->isBanned() || $user->department?->isBanned()) {
            return Str::random(48);
        }

        $allowedRoles = $this->settings->json('auth.allowed_login_role_ids');

        if ($allowedRoles !== [] && ! $user->roles()->whereIn('roles.id', $allowedRoles)->exists()) {
            return Str::random(48);
        }

        $generated = $this->verificationCodes->generate(
            $user,
            VerificationCode::PURPOSE_PASSWORDLESS_LOGIN,
            ipAddress: $ipAddress,
            userAgent: $userAgent,
        );

        $user->notify(new VerificationCodeNotification($generated['code'], VerificationCode::PURPOSE_PASSWORDLESS_LOGIN));

        return $generated['challenge_token'];
    }
}
