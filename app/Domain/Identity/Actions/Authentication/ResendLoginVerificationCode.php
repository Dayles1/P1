<?php

namespace App\Domain\Identity\Actions\Authentication;

use App\Domain\Identity\Models\VerificationCode;
use App\Domain\Identity\Notifications\VerificationCodeNotification;
use App\Domain\Identity\Services\VerificationCodeService;

/**
 * Resend for either code-based login flow (2FA-after-password or fully
 * passwordless) — looks up which pending attempt the old challenge token
 * belonged to (regardless of whether it already expired/was consumed) and
 * issues a fresh code + a new challenge token superseding it. Returns
 * null for an unknown token so the caller can still respond generically
 * (no enumeration signal).
 */
class ResendLoginVerificationCode
{
    public function __construct(
        private readonly VerificationCodeService $verificationCodes,
    ) {}

    public function handle(string $challengeToken, string $purpose): ?string
    {
        $previous = VerificationCode::query()
            ->where('challenge_token', $challengeToken)
            ->where('purpose', $purpose)
            ->first();

        if (! $previous?->user_id) {
            return null;
        }

        $generated = $this->verificationCodes->generate($previous->user, $purpose);

        $previous->user->notify(new VerificationCodeNotification($generated['code'], $purpose));

        return $generated['challenge_token'];
    }
}
