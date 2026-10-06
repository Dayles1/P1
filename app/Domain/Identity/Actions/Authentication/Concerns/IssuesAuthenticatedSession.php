<?php

namespace App\Domain\Identity\Actions\Authentication\Concerns;

use App\Application\DTO\Identity\DeviceData;
use App\Domain\Identity\Models\User;
use App\Domain\Identity\Models\UserSession;
use App\Domain\Notification\Services\LoginNotifier;

/**
 * Shared by every action that completes a login (password, 2FA
 * verification, passwordless code) so a Sanctum token and its matching
 * `UserSession` row are always issued the same way, once.
 */
trait IssuesAuthenticatedSession
{
    /** @return array{user: User, token: string} */
    private function issueTokenAndSession(User $user, DeviceData $device): array
    {
        $token = $user->createToken('auth');

        $session = UserSession::create([
            'user_id' => $user->id,
            'personal_access_token_id' => $token->accessToken->id,
            'ip_address' => $device->ip_address,
            'user_agent' => $device->user_agent,
            'device_type' => $device->device_type,
            'browser' => $device->browser,
            'platform' => $device->platform,
            'device_name' => $device->device_name,
            'logged_in_at' => now(),
            'last_activity_at' => now(),
        ]);

        // A sign-in from a device/browser/address this account was never
        // used from before is announced to its owner (see LoginNotifier).
        app(LoginNotifier::class)->sessionIssued($user, $session);

        return [
            'user' => $user,
            'token' => $token->plainTextToken,
        ];
    }
}
