<?php

namespace App\Domain\Identity\Services;

use App\Domain\Identity\Exceptions\VerificationCodeException;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\VerificationCode;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * One shared implementation of "generate a 6-digit code, email it, verify
 * it later" reused by login 2FA, passwordless login, and email
 * verification-by-code, instead of three near-identical mechanisms. Codes
 * are always stored hashed and are single-use, short-lived, and attempt-
 * limited.
 */
class VerificationCodeService
{
    private const MAX_ATTEMPTS = 5;

    private const DEFAULT_TTL_MINUTES = 10;

    /**
     * @return array{code: string, challenge_token: ?string, model: VerificationCode}
     */
    public function generate(
        ?User $user,
        string $purpose,
        int $ttlMinutes = self::DEFAULT_TTL_MINUTES,
        ?string $ipAddress = null,
        ?string $userAgent = null,
    ): array {
        $code = (string) random_int(100000, 999999);

        $usesChallengeToken = in_array($purpose, [
            VerificationCode::PURPOSE_LOGIN_2FA,
            VerificationCode::PURPOSE_PASSWORDLESS_LOGIN,
            VerificationCode::PURPOSE_EMAIL_VERIFICATION,
        ], true);

        if ($user) {
            // Invalidate any still-pending code of the same purpose so a
            // stale earlier code (e.g. from an abandoned attempt) can never
            // be used alongside a fresh one.
            VerificationCode::query()
                ->where('user_id', $user->id)
                ->where('purpose', $purpose)
                ->whereNull('consumed_at')
                ->update(['consumed_at' => now()]);
        }

        $model = VerificationCode::create([
            'user_id' => $user?->id,
            'purpose' => $purpose,
            'code_hash' => Hash::make($code),
            'challenge_token' => $usesChallengeToken ? Str::random(48) : null,
            'expires_at' => now()->addMinutes($ttlMinutes),
            'ip_address' => $ipAddress,
            'user_agent' => $userAgent,
        ]);

        return [
            'code' => $code,
            'challenge_token' => $model->challenge_token,
            'model' => $model,
        ];
    }

    /**
     * For unauthenticated flows (login 2FA, passwordless) — the client
     * proves which pending code it means via an opaque challenge token
     * rather than a user id, since it has no other identity to offer yet.
     */
    public function verifyByChallengeToken(string $challengeToken, string $code, string $purpose): User
    {
        $record = VerificationCode::query()
            ->where('challenge_token', $challengeToken)
            ->where('purpose', $purpose)
            ->first();

        return $this->consume($record, $code);
    }

    /**
     * For already-authenticated flows (email verification) — the user is
     * already known via their bearer token, so there's no enumeration risk
     * in looking their pending code up directly.
     */
    public function verifyForUser(User $user, string $code, string $purpose): User
    {
        $record = VerificationCode::query()
            ->where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->whereNull('consumed_at')
            ->latest('id')
            ->first();

        return $this->consume($record, $code);
    }

    private function consume(?VerificationCode $record, string $code): User
    {
        if (! $record || $record->isConsumed()) {
            throw VerificationCodeException::invalid();
        }

        if ($record->isExpired()) {
            throw VerificationCodeException::expired();
        }

        if ($record->attempts >= self::MAX_ATTEMPTS) {
            throw VerificationCodeException::tooManyAttempts();
        }

        $record->increment('attempts');

        if (! Hash::check($code, $record->code_hash)) {
            throw VerificationCodeException::invalid();
        }

        $record->update(['consumed_at' => now()]);

        $user = $record->user;

        if (! $user) {
            throw VerificationCodeException::invalid();
        }

        return $user;
    }
}
