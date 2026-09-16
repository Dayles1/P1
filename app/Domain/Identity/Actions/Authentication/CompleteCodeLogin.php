<?php

namespace App\Domain\Identity\Actions\Authentication;

use App\Application\DTO\Identity\DeviceData;
use App\Domain\Identity\Actions\Authentication\Concerns\IssuesAuthenticatedSession;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Services\VerificationCodeService;

/**
 * The second half of either code-based login flow — 2FA-after-password
 * (LoginUser having already verified the password and issued a challenge
 * token) or fully passwordless (RequestLoginCode). Both end the same way:
 * verify the code against its challenge token, then issue a real Sanctum
 * token + UserSession exactly like a normal password login would.
 */
class CompleteCodeLogin
{
    use IssuesAuthenticatedSession;

    public function __construct(
        private readonly VerificationCodeService $verificationCodes,
    ) {}

    /** @return array{user: User, token: string} */
    public function handle(string $challengeToken, string $code, string $purpose, DeviceData $device): array
    {
        $user = $this->verificationCodes->verifyByChallengeToken($challengeToken, $code, $purpose);

        return $this->issueTokenAndSession($user, $device);
    }
}
