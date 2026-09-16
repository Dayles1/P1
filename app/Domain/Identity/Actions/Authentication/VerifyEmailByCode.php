<?php

namespace App\Domain\Identity\Actions\Authentication;

use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\VerificationCode;
use App\Domain\Identity\Services\VerificationCodeService;
use Illuminate\Auth\Events\Verified;

/**
 * The code-entry counterpart to VerifyUserEmail (which handles the
 * signed-link click) — either one marks the account verified.
 */
class VerifyEmailByCode
{
    public function __construct(
        private readonly VerificationCodeService $verificationCodes,
    ) {}

    /**
     * $user is the already-authenticated caller (bearer token present). A
     * freshly registered user has no token yet, so in that case $user is
     * null and $challengeToken identifies the pending code instead — the
     * same idiom login/code/verify uses for the same reason.
     */
    public function handle(?User $user, string $code, ?string $challengeToken = null): bool
    {
        if ($user) {
            if ($user->hasVerifiedEmail()) {
                return false;
            }

            $this->verificationCodes->verifyForUser($user, $code, VerificationCode::PURPOSE_EMAIL_VERIFICATION);

            $user->markEmailAsVerified();

            event(new Verified($user));

            return true;
        }

        $verifiedUser = $this->verificationCodes->verifyByChallengeToken(
            (string) $challengeToken,
            $code,
            VerificationCode::PURPOSE_EMAIL_VERIFICATION,
        );

        if ($verifiedUser->hasVerifiedEmail()) {
            return false;
        }

        $verifiedUser->markEmailAsVerified();

        event(new Verified($verifiedUser));

        return true;
    }
}
